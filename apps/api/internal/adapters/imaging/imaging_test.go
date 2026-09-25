package imaging

import (
	"bytes"
	"encoding/binary"
	"image"
	"image/color"
	"image/jpeg"
	"image/png"
	"testing"
)

// block is a w×h image: left half red, right half blue.
func block(w, h int) *image.RGBA {
	img := image.NewRGBA(image.Rect(0, 0, w, h))
	for y := range h {
		for x := range w {
			c := color.RGBA{R: 255, A: 255}
			if x >= w/2 {
				c = color.RGBA{B: 255, A: 255}
			}
			img.Set(x, y, c)
		}
	}
	return img
}

// withOrientation inserts an EXIF APP1 segment (big-endian TIFF, one IFD0
// entry) right after the JPEG's SOI marker.
func withOrientation(t *testing.T, jpg []byte, orientation uint16) []byte {
	t.Helper()
	tiff := []byte("MM\x00\x2a\x00\x00\x00\x08")
	tiff = binary.BigEndian.AppendUint16(tiff, 1)
	tiff = binary.BigEndian.AppendUint16(tiff, 0x0112)
	tiff = binary.BigEndian.AppendUint16(tiff, 3) // SHORT
	tiff = binary.BigEndian.AppendUint32(tiff, 1)
	tiff = binary.BigEndian.AppendUint16(tiff, orientation)
	tiff = append(tiff, 0, 0, 0, 0, 0, 0) // value padding + next IFD
	payload := append([]byte("Exif\x00\x00"), tiff...)
	segment := []byte{0xFF, 0xE1}
	segment = binary.BigEndian.AppendUint16(segment, uint16(len(payload)+2))
	segment = append(segment, payload...)
	return append(append([]byte{0xFF, 0xD8}, segment...), jpg[2:]...)
}

func encodeJPEG(t *testing.T, img image.Image) []byte {
	t.Helper()
	var buf bytes.Buffer
	if err := jpeg.Encode(&buf, img, nil); err != nil {
		t.Fatal(err)
	}
	return buf.Bytes()
}

func decode(t *testing.T, data []byte) image.Image {
	t.Helper()
	img, format, err := image.Decode(bytes.NewReader(data))
	if err != nil || format != "jpeg" {
		t.Fatalf("output is not a JPEG: %s %v", format, err)
	}
	return img
}

func TestNormalizeFitsAndReencodes(t *testing.T) {
	var buf bytes.Buffer
	_ = png.Encode(&buf, block(3200, 1600))
	out, err := New().Normalize(buf.Bytes())
	if err != nil {
		t.Fatal(err)
	}
	if b := decode(t, out).Bounds(); b.Dx() != 1600 || b.Dy() != 800 {
		t.Fatalf("size = %v", b)
	}
	small, _ := New().Normalize(encodeJPEG(t, block(40, 20)))
	if b := decode(t, small).Bounds(); b.Dx() != 40 || b.Dy() != 20 {
		t.Fatalf("small image was resized: %v", b)
	}
}

func TestNormalizeAppliesOrientationAndStripsExif(t *testing.T) {
	rotated := withOrientation(t, encodeJPEG(t, block(64, 32)), 6)
	if got := jpegOrientation(rotated); got != 6 {
		t.Fatalf("orientation = %d", got)
	}
	out, err := New().Normalize(rotated)
	if err != nil {
		t.Fatal(err)
	}
	img := decode(t, out)
	if b := img.Bounds(); b.Dx() != 32 || b.Dy() != 64 {
		t.Fatalf("rotated size = %v", b)
	}
	// 90° clockwise: the red left half ends up on top.
	if r, _, bl, _ := img.At(16, 8).RGBA(); r < bl {
		t.Errorf("top should be red after rotation")
	}
	if bytes.Contains(out, []byte("Exif")) {
		t.Error("EXIF survived the re-encode")
	}
}

func TestOrientations(t *testing.T) {
	src := block(4, 2)
	for o := 1; o <= 8; o++ {
		b := orient(src, o).Bounds()
		wantW, wantH := 4, 2
		if o >= 5 {
			wantW, wantH = 2, 4
		}
		if b.Dx() != wantW || b.Dy() != wantH {
			t.Errorf("orientation %d: %v", o, b)
		}
	}
	// Mirror (2): the red left half moves right.
	if r, _, _, _ := orient(src, 2).At(3, 0).RGBA(); r == 0 {
		t.Error("orientation 2 should mirror")
	}
}

func TestNormalizeRejects(t *testing.T) {
	for name, data := range map[string][]byte{
		"text":      []byte("hello, not an image"),
		"truncated": encodeJPEG(t, block(10, 10))[:40],
		"gif":       []byte("GIF89a\x01\x00\x01\x00"),
	} {
		if _, err := New().Normalize(data); err == nil {
			t.Errorf("%s: accepted", name)
		}
	}
	if jpegOrientation([]byte("junk")) != 1 {
		t.Error("junk orientation")
	}
}

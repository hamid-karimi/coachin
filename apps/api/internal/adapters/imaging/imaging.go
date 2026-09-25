// Package imaging normalizes uploaded photos in pure Go (legacy used sharp):
// decode JPEG / PNG / WebP, apply the EXIF orientation, fit inside
// 1600×1600 without enlarging, and re-encode as JPEG quality 82. Re-encoding
// drops every metadata block (EXIF, GPS, ICC), so nothing identifying is
// stored.
package imaging

import (
	"bytes"
	"errors"
	"image"
	"image/jpeg"
	_ "image/png" // register the PNG decoder
	"net/http"

	"golang.org/x/image/draw"
	_ "golang.org/x/image/webp" // register the WebP decoder
)

// Limits (legacy sharp pipeline).
const (
	MaxSide = 1600
	Quality = 82
	// maxPixels refuses decompression bombs before decoding.
	maxPixels = 40_000_000
)

// ErrUnreadable is any file that isn't a decodable JPEG, PNG, or WebP.
var ErrUnreadable = errors.New("unreadable image")

// accepted are the content types allowed in, by sniffing (not the client's
// claim).
var accepted = map[string]bool{"image/jpeg": true, "image/png": true, "image/webp": true}

// Accepted reports whether data sniffs as JPEG, PNG, or WebP.
func Accepted(data []byte) bool {
	return accepted[http.DetectContentType(data)]
}

// Normalizer implements the photo use cases' encoder.
type Normalizer struct{}

// New returns the normalizer.
func New() Normalizer { return Normalizer{} }

// Normalize re-encodes an upload as an upright JPEG of at most MaxSide px.
func (Normalizer) Normalize(data []byte) ([]byte, error) {
	if !Accepted(data) {
		return nil, ErrUnreadable
	}
	cfg, _, err := image.DecodeConfig(bytes.NewReader(data))
	if err != nil || cfg.Width <= 0 || cfg.Height <= 0 || cfg.Width*cfg.Height > maxPixels {
		return nil, ErrUnreadable
	}
	src, _, err := image.Decode(bytes.NewReader(data))
	if err != nil {
		return nil, ErrUnreadable
	}
	// Scale first (cheaper), then turn upright; the bound is square, so the
	// order doesn't change the result.
	img := orient(fit(src, MaxSide), jpegOrientation(data))
	var out bytes.Buffer
	if err := jpeg.Encode(&out, img, &jpeg.Options{Quality: Quality}); err != nil {
		return nil, err
	}
	return out.Bytes(), nil
}

// fit scales img down to fit inside side×side, keeping the aspect ratio;
// smaller images are copied as they are.
func fit(img image.Image, side int) image.Image {
	b := img.Bounds()
	w, h := b.Dx(), b.Dy()
	if w <= side && h <= side {
		return toRGBA(img)
	}
	if w >= h {
		h, w = max(1, h*side/w), side
	} else {
		w, h = max(1, w*side/h), side
	}
	dst := image.NewRGBA(image.Rect(0, 0, w, h))
	draw.CatmullRom.Scale(dst, dst.Bounds(), img, b, draw.Src, nil)
	return dst
}

func toRGBA(img image.Image) *image.RGBA {
	b := img.Bounds()
	dst := image.NewRGBA(image.Rect(0, 0, b.Dx(), b.Dy()))
	draw.Draw(dst, dst.Bounds(), img, b.Min, draw.Src)
	return dst
}

package imaging

import (
	"encoding/binary"
	"image"
)

// jpegOrientation reads the EXIF orientation tag (1–8) from a JPEG's APP1
// segment; 1 (upright) when absent or unreadable.
func jpegOrientation(data []byte) int {
	if len(data) < 4 || data[0] != 0xFF || data[1] != 0xD8 {
		return 1
	}
	for i := 2; i+4 <= len(data); {
		if data[i] != 0xFF {
			return 1
		}
		marker := data[i+1]
		if marker == 0xDA || marker == 0xD9 { // start of scan / end: no EXIF before the pixels
			return 1
		}
		size := int(binary.BigEndian.Uint16(data[i+2 : i+4]))
		if size < 2 || i+2+size > len(data) {
			return 1
		}
		segment := data[i+4 : i+2+size]
		if marker == 0xE1 && len(segment) > 6 && string(segment[:6]) == "Exif\x00\x00" {
			return tiffOrientation(segment[6:])
		}
		i += 2 + size
	}
	return 1
}

// tiffOrientation finds tag 0x0112 in IFD0 of a TIFF block.
func tiffOrientation(tiff []byte) int {
	if len(tiff) < 8 {
		return 1
	}
	var order binary.ByteOrder
	switch string(tiff[:2]) {
	case "II":
		order = binary.LittleEndian
	case "MM":
		order = binary.BigEndian
	default:
		return 1
	}
	offset := int(order.Uint32(tiff[4:8]))
	if offset+2 > len(tiff) {
		return 1
	}
	count := int(order.Uint16(tiff[offset : offset+2]))
	for n := range count {
		entry := offset + 2 + n*12
		if entry+12 > len(tiff) {
			return 1
		}
		if order.Uint16(tiff[entry:entry+2]) == 0x0112 {
			if v := int(order.Uint16(tiff[entry+8 : entry+10])); v >= 1 && v <= 8 {
				return v
			}
			return 1
		}
	}
	return 1
}

// orient returns img turned upright for an EXIF orientation.
func orient(img image.Image, orientation int) image.Image {
	if orientation <= 1 || orientation > 8 {
		return img
	}
	b := img.Bounds()
	w, h := b.Dx(), b.Dy()
	// 5–8 swap width and height.
	dw, dh := w, h
	if orientation >= 5 {
		dw, dh = h, w
	}
	dst := image.NewRGBA(image.Rect(0, 0, dw, dh))
	transforms[orientation](dst, img, b, w, h)
	return dst
}

// transforms map each source pixel (x, y) to its upright position.
var transforms = map[int]func(dst *image.RGBA, src image.Image, b image.Rectangle, w, h int){
	2: each(func(x, y, w, _ int) (int, int) { return w - 1 - x, y }),
	3: each(func(x, y, w, h int) (int, int) { return w - 1 - x, h - 1 - y }),
	4: each(func(x, y, _, h int) (int, int) { return x, h - 1 - y }),
	5: each(func(x, y, _, _ int) (int, int) { return y, x }),
	6: each(func(x, y, _, h int) (int, int) { return h - 1 - y, x }),
	7: each(func(x, y, w, h int) (int, int) { return h - 1 - y, w - 1 - x }),
	8: each(func(x, y, w, _ int) (int, int) { return y, w - 1 - x }),
}

func each(move func(x, y, w, h int) (int, int)) func(*image.RGBA, image.Image, image.Rectangle, int, int) {
	return func(dst *image.RGBA, src image.Image, b image.Rectangle, w, h int) {
		for y := range h {
			for x := range w {
				dx, dy := move(x, y, w, h)
				dst.Set(dx, dy, src.At(b.Min.X+x, b.Min.Y+y))
			}
		}
	}
}

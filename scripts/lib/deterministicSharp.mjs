import sharp from 'sharp';

// Use the scalar libvips path for authored character renders. CPU-specific
// SIMD rounding must never become a different reviewed/deployed character.
// This configures source rendering; it does not repair output image pixels.
sharp.simd(false);
export default sharp;

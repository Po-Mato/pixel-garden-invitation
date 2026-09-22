import sharp from 'sharp';

// Disable optional SIMD in source resampling. Compiler-vector source blending
// is separately pinned in paintedSourceOverlay; this switch alone does not
// control that arithmetic. Neither path repairs finished frame pixels.
sharp.simd(false);
export default sharp;

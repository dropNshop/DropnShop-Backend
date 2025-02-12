const { bucket } = require('../Configs/firebase.config');
const { v4: uuidv4 } = require('uuid');
const sharp = require('sharp');

// ============ Image Processing Utils ============
const optimizeImage = async (imageBuffer, contentType) => {
    // Determine format based on content type
    const format = contentType.includes('png') ? 'png' : 'jpeg';
    
    return sharp(imageBuffer)
        .resize(800, 800, { // Reduced max dimensions for better optimization
            fit: 'inside',
            withoutEnlargement: true
        })
        [format]({
            quality: 70 // Slightly reduced quality for smaller file size
        })
        .toBuffer();
};

// Generate timestamp-based ID (more compact than UUID)
const generateShortId = () => {
    const timestamp = Date.now().toString(36); // Convert to base36
    const random = Math.random().toString(36).substring(2, 5);
    return `${timestamp}${random}`;
};

// ============ Firebase Upload Logic ============
async function uploadImageToFirebase(base64Image, contentType = 'image/jpeg') {
    try {
        // Remove data URL prefix if present
        const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, '');
        
        // Convert base64 to buffer
        const imageBuffer = Buffer.from(base64Data, 'base64');

        // Optimize image before upload
        const optimizedBuffer = await optimizeImage(imageBuffer, contentType);

        // Generate compact filename
        const shortId = generateShortId();
        const ext = contentType.includes('png') ? 'png' : 'jpg';
        const filename = `i/${shortId}.${ext}`; // Even shorter path prefix

        // Create file reference
        const file = bucket.file(filename);

        // Upload optimized file
        await file.save(optimizedBuffer, {
            metadata: {
                contentType: contentType,
            },
            public: true // Make the file publicly accessible
        });

        // Get public URL (much shorter than signed URL)
        const publicUrl = `https://storage.googleapis.com/${bucket.name}/${filename}`;
        return publicUrl;

    } catch (error) {
        console.error('Upload error:', error);
        throw new Error(`Image upload failed: ${error.message}`);
    }
}

module.exports = { uploadImageToFirebase }; 
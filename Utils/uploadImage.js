const { bucket } = require('../Configs/firebase.config');
const { v4: uuidv4 } = require('uuid');
const sharp = require('sharp');

// ============ Image Processing Utils ============
const optimizeImage = async (imageBuffer, contentType) => {
    // Determine format based on content type
    const format = contentType.includes('png') ? 'png' : 'jpeg';
    
    return sharp(imageBuffer)
        .resize(1200, 1200, { // Max dimensions
            fit: 'inside',
            withoutEnlargement: true
        })
        [format]({
            quality: 80 // Good balance between quality and size
        })
        .toBuffer();
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

        // Generate shorter unique filename (8 chars from uuid)
        const shortId = uuidv4().split('-')[0];
        const filename = `p/${shortId}.${contentType.split('/')[1] || 'jpg'}`;

        // Create file reference
        const file = bucket.file(filename);

        // Upload optimized file
        await file.save(optimizedBuffer, {
            metadata: {
                contentType: contentType,
            },
        });

        // Get signed URL with shorter expiration
        const [url] = await file.getSignedUrl({
            action: 'read',
            expires: '03-01-2025', // Shorter expiration
        });

        return url;
    } catch (error) {
        console.error('Upload error:', error);
        throw new Error(`Image upload failed: ${error.message}`);
    }
}

module.exports = { uploadImageToFirebase }; 
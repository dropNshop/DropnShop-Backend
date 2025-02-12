const { bucket } = require('../Configs/firebase.config');
const { v4: uuidv4 } = require('uuid');

async function uploadImageToFirebase(base64Image, contentType = 'image/jpeg') {
    try {
        // Remove data URL prefix if present
        const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, '');
        
        // Convert base64 to buffer
        const imageBuffer = Buffer.from(base64Data, 'base64');

        // Generate unique filename
        const filename = `products/${uuidv4()}.${contentType.split('/')[1] || 'jpg'}`;

        // Create file reference
        const file = bucket.file(filename);

        // Upload file
        await file.save(imageBuffer, {
            metadata: {
                contentType: contentType,
            },
        });

        // Get signed URL
        const [url] = await file.getSignedUrl({
            action: 'read',
            expires: '03-01-2500',
        });

        return url;
    } catch (error) {
        console.error('Upload error:', error);
        throw error;
    }
}

module.exports = { uploadImageToFirebase }; 
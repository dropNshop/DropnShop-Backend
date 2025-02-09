const { bucket } = require('../Configs/firebase.config');
const { v4: uuidv4 } = require('uuid');
const sharp = require('sharp');

async function uploadImageToFirebase(base64Image, contentType = 'image/jpeg') {
    try {
        // Remove data URL prefix if present
        const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, '');
        
        // Convert base64 to buffer
        const imageBuffer = Buffer.from(base64Data, 'base64');

        // Compress image
        const compressedImageBuffer = await sharp(imageBuffer)
            .resize(800, 800, {
                fit: 'inside',
                withoutEnlargement: true
            })
            .jpeg({ quality: 80 })
            .toBuffer();

        // Generate unique filename
        const filename = `products/${uuidv4()}.jpg`;

        // Create file reference
        const file = bucket.file(filename);

        // Create write stream
        const stream = file.createWriteStream({
            metadata: {
                contentType: 'image/jpeg'
            },
            resumable: false
        });

        // Handle upload
        return new Promise((resolve, reject) => {
            stream.on('error', (error) => {
                reject(error);
            });

            stream.on('finish', async () => {
                // Get public URL
                const publicUrl = `https://storage.googleapis.com/${bucket.name}/${filename}`;
                resolve(publicUrl);
            });

            stream.end(compressedImageBuffer);
        });
    } catch (error) {
        console.error('Upload error:', error);
        throw error;
    }
}

module.exports = { uploadImageToFirebase }; 
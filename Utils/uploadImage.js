const { bucket } = require('../Configs/firebase.config');
const { v4: uuidv4 } = require('uuid');
const sharp = require('sharp');

async function uploadImageToFirebase(base64Image) {
    try {
        // Remove the data:image/jpeg;base64, prefix if present
        const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, '');
        
        // Convert base64 to buffer
        const imageBuffer = Buffer.from(base64Data, 'base64');

        // Compress image
        const compressedImageBuffer = await sharp(imageBuffer)
            .resize(800, 800, { // Max dimensions
                fit: 'inside',
                withoutEnlargement: true
            })
            .jpeg({ quality: 80 }) // Compress to JPEG
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

        // Handle upload using Promise
        return new Promise((resolve, reject) => {
            stream.on('error', (error) => {
                console.error('Upload stream error:', error);
                reject(new Error('Failed to upload image: ' + error.message));
            });

            stream.on('finish', async () => {
                try {
                    // Make the file publicly accessible
                    await file.makePublic();
                    
                    // Get the public URL
                    const publicUrl = `https://storage.googleapis.com/${bucket.name}/${filename}`;
                    resolve(publicUrl);
                } catch (error) {
                    console.error('Error making file public:', error);
                    reject(new Error('Failed to make file public: ' + error.message));
                }
            });

            // Write the buffer to the stream and end it
            stream.end(compressedImageBuffer);
        });
    } catch (error) {
        console.error('Error in uploadImageToFirebase:', error);
        throw error;
    }
}

module.exports = { uploadImageToFirebase }; 
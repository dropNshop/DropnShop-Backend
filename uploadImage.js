const { bucket } = require('./Configs/firebase.config');
const { v4: uuidv4 } = require('uuid');

async function uploadImageToFirebase(base64Image, contentType = 'image/jpeg') {
    try {
        // Ensure we have a valid content type
        if (!contentType) {
            contentType = 'image/jpeg';
        }

        // Generate a unique filename
        const filename = `products/${uuidv4()}.${contentType.split('/')[1] || 'jpg'}`;

        // Create file buffer from base64
        let imageBuffer;
        try {
            // Check if the base64 string includes the data URL prefix
            if (base64Image.includes('base64,')) {
                imageBuffer = Buffer.from(
                    base64Image.split('base64,')[1],
                    'base64'
                );
            } else {
                imageBuffer = Buffer.from(base64Image, 'base64');
            }
        } catch (error) {
            console.error('Error creating buffer:', error);
            throw new Error('Invalid base64 image data');
        }

        // Create file reference
        const file = bucket.file(filename);

        // Create write stream with proper options
        const stream = file.createWriteStream({
            metadata: {
                contentType: contentType
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
            stream.end(imageBuffer);
        });
    } catch (error) {
        console.error('uploadImageToFirebase error:', error);
        throw error;
    }
}

module.exports = { uploadImageToFirebase };
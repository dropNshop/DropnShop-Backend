const storage = require('../Configs/firebase.config');
const { ref, uploadString, getDownloadURL } = require('firebase/storage');
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

        // Convert back to base64
        const compressedBase64 = `data:image/jpeg;base64,${compressedImageBuffer.toString('base64')}`;

        // Create unique filename
        const filename = `products/${uuidv4()}.jpg`;
        const storageRef = ref(storage, filename);

        // Upload the compressed image
        await uploadString(storageRef, compressedBase64, 'data_url');
        
        // Get the public URL
        const url = await getDownloadURL(storageRef);
        
        return url;
    } catch (error) {
        console.error('Error uploading image:', error);
        throw new Error('Failed to upload image');
    }
}

module.exports = { uploadImageToFirebase }; 
const admin = require('./config');
const { v4: uuidv4 } = require('uuid');

const bucket = admin.storage().bucket();

async function uploadImageToFirebase(base64Image, contentType) {
  try {
    const filename = `images/${uuidv4()}.${contentType.split('/')[1]}`;

    const imageBuffer = Buffer.from(base64Image, 'base64');

    const file = bucket.file(filename);

    await file.save(imageBuffer, {
      metadata: {
        contentType: contentType,
      },
    });

    const [url] = await file.getSignedUrl({
      action: 'read',
      expires: '03-01-2500', 
    });

    return url;
  } catch (error) {
    console.error('Error uploading image:', error);
    throw new Error('Failed to upload image');
  }
}

module.exports = { uploadImageToFirebase };
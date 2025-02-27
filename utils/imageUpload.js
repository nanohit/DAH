const axios = require('axios');
const FormData = require('form-data');

const uploadImage = async (imageBuffer) => {
    try {
        const formData = new FormData();
        formData.append('image', imageBuffer.toString('base64'));
        
        const response = await axios.post(`https://api.imgbb.com/1/upload`, formData, {
            params: {
                key: process.env.IMGBB_API_KEY
            },
            headers: formData.getHeaders()
        });

        if (response.data.success) {
            return {
                success: true,
                imageUrl: response.data.data.url,
                deleteUrl: response.data.data.delete_url
            };
        } else {
            throw new Error('Failed to upload image');
        }
    } catch (error) {
        console.error('Error uploading image:', error);
        return {
            success: false,
            error: error.message
        };
    }
};

module.exports = { uploadImage }; 
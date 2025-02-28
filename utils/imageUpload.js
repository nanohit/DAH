const axios = require('axios');
const FormData = require('form-data');

const uploadImage = async (imageBuffer) => {
    try {
        console.log('\n=== ImgBB Upload Debug ===');
        console.log('Received buffer size:', imageBuffer.length);
        
        if (!process.env.IMGBB_API_KEY) {
            throw new Error('ImgBB API key is not configured');
        }
        console.log('API Key exists:', true);

        const formData = new FormData();
        const base64Image = imageBuffer.toString('base64');
        console.log('Base64 image length:', base64Image.length);
        
        formData.append('image', base64Image);
        
        console.log('Sending request to ImgBB...');
        const response = await axios.post(`https://api.imgbb.com/1/upload`, formData, {
            params: {
                key: process.env.IMGBB_API_KEY
            },
            headers: formData.getHeaders()
        });
        
        console.log('ImgBB response status:', response.status);
        console.log('ImgBB response data:', response.data);

        if (response.data.success) {
            return {
                success: true,
                imageUrl: response.data.data.url,
                deleteUrl: response.data.data.delete_url
            };
        } else {
            throw new Error('Failed to upload image to ImgBB: Response indicated failure');
        }
    } catch (error) {
        console.error('\n=== ImgBB Upload Error ===');
        if (error.response?.data) {
            console.error('API Error:', error.response.data);
        }
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
        return {
            success: false,
            error: error.message
        };
    }
};

module.exports = { uploadImage }; 
/**
 * VK Image Uploader
 * Handles image uploads to VK using the photos API
 * Uses user access token with photos permission
 */
const axios = require('axios');
const FormData = require('form-data');

class VKImageUploader {
    constructor() {
        this.token = process.env.VK_TOKEN;
        this.apiVersion = process.env.VK_API_VERSION || '5.199';
        this.baseUrl = 'https://api.vk.com/method';
    }

    async getUploadServer() {
        try {
            const response = await axios.get(`${this.baseUrl}/photos.getUploadServer`, {
                params: {
                    v: this.apiVersion
                },
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });
            
            if (response.data.error) {
                throw new Error(response.data.error.error_msg);
            }
            
            return response.data.response.upload_url;
        } catch (error) {
            console.error('Error getting upload server:', error.response?.data || error.message);
            throw new Error('Failed to get upload server');
        }
    }

    async uploadImage(imageBuffer) {
        try {
            // Get upload server
            const uploadUrl = await this.getUploadServer();

            // Create form data with image
            const formData = new FormData();
            formData.append('photo', imageBuffer, {
                filename: 'image.jpg',
                contentType: 'image/jpeg'
            });

            // Upload to VK server
            const uploadResponse = await axios.post(uploadUrl, formData, {
                headers: {
                    ...formData.getHeaders(),
                    'Authorization': `Bearer ${this.token}`
                }
            });

            if (uploadResponse.data.error) {
                throw new Error(uploadResponse.data.error.error_msg);
            }

            // Save photo
            const saveResponse = await axios.post(`${this.baseUrl}/photos.save`, null, {
                params: {
                    server: uploadResponse.data.server,
                    photos_list: uploadResponse.data.photos_list,
                    hash: uploadResponse.data.hash,
                    v: this.apiVersion
                },
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });

            if (saveResponse.data.error) {
                throw new Error(saveResponse.data.error.error_msg);
            }

            const photo = saveResponse.data.response[0];
            const sizes = photo.sizes;
            const largestSize = sizes.reduce((prev, curr) => 
                (prev.width * prev.height > curr.width * curr.height) ? prev : curr
            );

            return {
                url: largestSize.url,
                vkPhotoId: `${photo.owner_id}_${photo.id}`
            };
        } catch (error) {
            console.error('Error uploading image:', error.response?.data || error.message);
            throw new Error('Failed to upload image');
        }
    }

    async verifyPhoto(vkPhotoId) {
        try {
            const response = await axios.get(`${this.baseUrl}/photos.getById`, {
                params: {
                    photos: vkPhotoId,
                    v: this.apiVersion
                },
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });

            if (response.data.error) {
                throw new Error(response.data.error.error_msg);
            }

            return response.data.response.length > 0;
        } catch (error) {
            console.error('Error verifying photo:', error.response?.data || error.message);
            return false;
        }
    }
}

module.exports = new VKImageUploader(); 
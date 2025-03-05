const axios = require('axios');
const FormData = require('form-data');
const { Readable } = require('stream');

class VKStorageService {
    constructor() {
        this.token = process.env.VK_SERVICE_TOKEN;
        this.groupId = process.env.VK_GROUP_ID;
        this.apiVersion = '5.131';
        this.apiBase = 'https://api.vk.com/method';
    }

    /**
     * Get upload server URL for documents
     * @private
     */
    async getUploadServer() {
        const response = await axios.get(`${this.apiBase}/docs.getUploadServer`, {
            params: {
                group_id: this.groupId,
                access_token: this.token,
                v: this.apiVersion
            }
        });

        if (response.data.error) {
            throw new Error(`VK API Error: ${response.data.error.error_msg}`);
        }

        return response.data.response.upload_url;
    }

    /**
     * Save document in VK storage
     * @private
     * @param {Object} uploadResponse - Response from upload server
     * @param {string} title - Document title
     */
    async saveDoc(uploadResponse, title) {
        const response = await axios.get(`${this.apiBase}/docs.save`, {
            params: {
                file: uploadResponse.file,
                title: title,
                access_token: this.token,
                v: this.apiVersion
            }
        });

        if (response.data.error) {
            throw new Error(`VK API Error: ${response.data.error.error_msg}`);
        }

        const doc = response.data.response[0];
        return {
            id: doc.id,
            ownerId: doc.owner_id,
            title: doc.title,
            size: doc.size,
            ext: doc.ext,
            url: doc.url,
            // VK document direct link format
            directUrl: `https://vk.com/doc${doc.owner_id}_${doc.id}`
        };
    }

    /**
     * Upload file stream to VK Documents
     * @param {Stream} fileStream - Stream of the file to upload
     * @param {string} fileName - Name of the file
     * @param {string} format - File format (epub, fb2, etc.)
     */
    async uploadFile(fileStream, fileName, format) {
        try {
            // Get upload server URL
            const uploadUrl = await this.getUploadServer();

            // Prepare form data
            const formData = new FormData();
            formData.append('file', fileStream, {
                filename: `${fileName}.${format}`,
                contentType: this.getContentType(format)
            });

            // Upload file to VK server
            const uploadResponse = await axios.post(uploadUrl, formData, {
                headers: formData.getHeaders(),
                maxContentLength: Infinity,
                maxBodyLength: Infinity
            });

            if (uploadResponse.data.error) {
                throw new Error(`Upload Error: ${uploadResponse.data.error}`);
            }

            // Save document in VK storage
            return await this.saveDoc(uploadResponse.data, `${fileName}.${format}`);
        } catch (error) {
            console.error('VK Upload Error:', error);
            throw new Error(`Failed to upload file to VK: ${error.message}`);
        }
    }

    /**
     * Upload file from URL to VK Documents
     * @param {string} url - URL of the file to upload
     * @param {string} fileName - Name to save the file as
     * @param {string} format - File format (epub, fb2, etc.)
     */
    async uploadFromUrl(url, fileName, format) {
        try {
            // Download file from URL as stream
            const response = await axios({
                method: 'GET',
                url: url,
                responseType: 'stream'
            });

            // Upload stream to VK
            return await this.uploadFile(response.data, fileName, format);
        } catch (error) {
            console.error('VK Upload From URL Error:', error);
            throw new Error(`Failed to upload file from URL to VK: ${error.message}`);
        }
    }

    /**
     * Get content type for file format
     * @private
     * @param {string} format - File format
     */
    getContentType(format) {
        const contentTypes = {
            'epub': 'application/epub+zip',
            'fb2': 'application/xml',
            'mobi': 'application/x-mobipocket-ebook',
            'pdf': 'application/pdf'
        };
        return contentTypes[format] || 'application/octet-stream';
    }

    /**
     * Check if document still exists and accessible
     * @param {string} ownerId - Document owner ID
     * @param {string} docId - Document ID
     */
    async checkDocument(ownerId, docId) {
        try {
            const response = await axios.get(`${this.apiBase}/docs.getById`, {
                params: {
                    docs: `${ownerId}_${docId}`,
                    access_token: this.token,
                    v: this.apiVersion
                }
            });

            return response.data.response && response.data.response.length > 0;
        } catch (error) {
            console.error('VK Check Document Error:', error);
            return false;
        }
    }

    /**
     * Delete document from VK storage
     * @param {string} ownerId - Document owner ID
     * @param {string} docId - Document ID
     */
    async deleteDocument(ownerId, docId) {
        try {
            const response = await axios.get(`${this.apiBase}/docs.delete`, {
                params: {
                    owner_id: ownerId,
                    doc_id: docId,
                    access_token: this.token,
                    v: this.apiVersion
                }
            });

            return response.data.response === 1;
        } catch (error) {
            console.error('VK Delete Document Error:', error);
            throw new Error(`Failed to delete document from VK: ${error.message}`);
        }
    }
}

module.exports = VKStorageService; 
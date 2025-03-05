require('dotenv').config();
const VKStorageService = require('./VKStorageService');
const FlibustaService = require('../flibusta/FlibustaService');

async function testVKStorage() {
    const vk = new VKStorageService();
    const flibusta = new FlibustaService();
    
    try {
        console.log('\n🔍 Step 1: Finding a test book...');
        const searchResults = await flibusta.searchBooks('Доктор Живаго');
        
        // Find the Litres version
        const book = searchResults.find(b => 
            b.title.includes('[litres]') && 
            b.author.name === 'Борис Леонидович Пастернак'
        );

        if (!book) {
            throw new Error('Test book not found');
        }

        console.log('\n📚 Found book:', book.title);
        console.log('Author:', book.author.name);
        console.log('ID:', book.id);

        // Try to upload epub format
        const format = 'epub';
        const formatInfo = book.formats.find(f => f.format === format);
        
        if (!formatInfo) {
            throw new Error(`Format ${format} not found`);
        }

        console.log(`\n📤 Step 2: Uploading ${format} format to VK...`);
        console.log('Source URL:', formatInfo.url);
        
        const fileName = `${book.title} - ${book.author.name}`;
        const result = await vk.uploadFromUrl(formatInfo.url, fileName, format);

        console.log('\n✅ Upload successful!');
        console.log('Document ID:', result.id);
        console.log('Owner ID:', result.ownerId);
        console.log('Title:', result.title);
        console.log('Size:', result.size, 'bytes');
        console.log('Direct URL:', result.directUrl);

        // Verify the document exists
        console.log('\n🔍 Step 3: Verifying document...');
        const exists = await vk.checkDocument(result.ownerId, result.id);
        console.log('Document exists:', exists);

        if (exists) {
            // Clean up - delete the test document
            console.log('\n🧹 Step 4: Cleaning up...');
            const deleted = await vk.deleteDocument(result.ownerId, result.id);
            console.log('Document deleted:', deleted);
        }

    } catch (error) {
        console.error('\n❌ Test failed:', error.message);
        if (error.response?.data) {
            console.error('API Error:', error.response.data);
        }
    }
}

// Run the test
testVKStorage(); 
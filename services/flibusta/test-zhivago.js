require('dotenv').config();
const FlibustaService = require('./FlibustaService');

async function testZhivagoSearch() {
    const flibusta = new FlibustaService();
    
    try {
        // Step 1: Search for all variants
        console.log('\n🔍 Step 1: Searching for all "Доктор Живаго" variants...');
        const results = await flibusta.searchBooks('Доктор Живаго');

        console.log(`\nFound ${results.length} variants:`);
        results.forEach((book, index) => {
            console.log(`\n📚 Variant ${index + 1}:`);
            console.log('Title:', book.title);
            console.log('Author:', book.author.name);
            console.log('Book ID:', book.id);
            console.log('Available formats:');
            book.formats.forEach(format => {
                console.log(`- ${format.format}: ${format.url}`);
            });
        });

        // Step 2: Select a specific variant (let's choose the Litres version)
        const selectedVariant = results.find(book => 
            book.title.includes('[litres]') && 
            book.author.name === 'Борис Леонидович Пастернак'
        );

        if (selectedVariant) {
            console.log('\n🎯 Step 2: Selected variant:');
            console.log('Title:', selectedVariant.title);
            console.log('Author:', selectedVariant.author.name);
            console.log('Book ID:', selectedVariant.id);

            // Step 3: Verify download links
            console.log('\n📥 Step 3: Verifying download links...');
            
            for (const format of selectedVariant.formats) {
                try {
                    console.log(`\nVerifying ${format.format} format...`);
                    const verifiedUrl = await flibusta.verifyDownloadLink(selectedVariant.id, format.format);
                    console.log('✅ Available:', verifiedUrl);
                } catch (error) {
                    console.log('❌ Not available:', error.message);
                }
            }
        } else {
            console.log('\n❌ Could not find the Litres variant');
        }

        console.log('\n✅ Test completed!');
    } catch (error) {
        console.error('\n❌ Test failed:', error.message);
    }
}

testZhivagoSearch(); 
require('dotenv').config();
const FlibustaService = require('./FlibustaService');

async function runTests() {
  const service = new FlibustaService();
  
  try {
    // Test 1: Search for a book
    console.log('\n🔍 Test 1: Searching for "1984 Orwell"...');
    const searchResults = await service.searchBooks('1984 Orwell');
    console.log(`Found ${searchResults.length} results`);
    console.log('First result:', JSON.stringify(searchResults[0], null, 2));

    if (searchResults.length > 0) {
      const firstBook = searchResults[0];
      
      // Test 2: Get download links for each available format
      console.log('\n📚 Test 2: Getting download links for available formats...');
      for (const format of firstBook.formats) {
        try {
          console.log(`\nTrying format: ${format.format}`);
          const downloadLink = await service.getDownloadLink(firstBook.sourceUrl, format.format);
          console.log('Success! Download link:', downloadLink);
        } catch (error) {
          console.error(`Failed to get link for ${format.format}:`, error.message);
        }
      }

      // Test 3: Test caching
      console.log('\n💾 Test 3: Testing cache...');
      console.time('First call');
      await service.searchBooks('1984 Orwell');
      console.timeEnd('First call');
      
      console.time('Cached call');
      await service.searchBooks('1984 Orwell');
      console.timeEnd('Cached call');

      // Test 4: Clear cache
      console.log('\n🧹 Test 4: Testing cache clearing...');
      service.clearCache('1984 Orwell');
      console.log('Cache cleared for "1984 Orwell"');
      
      console.time('After cache clear');
      await service.searchBooks('1984 Orwell');
      console.timeEnd('After cache clear');
    }

    // Test 5: Error handling
    console.log('\n❌ Test 5: Testing error handling...');
    try {
      await service.searchBooks('');
      console.log('Should have thrown an error for empty search');
    } catch (error) {
      console.log('Successfully caught error for empty search:', error.message);
    }

    console.log('\n✅ All tests completed!');
  } catch (error) {
    console.error('\n❌ Test suite failed:', error);
  }
}

// Run the tests
runTests(); 
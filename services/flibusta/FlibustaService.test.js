const FlibustaService = require('./FlibustaService');

async function testFlibustaService() {
  const service = new FlibustaService();
  
  try {
    console.log('Testing book search...');
    const searchResults = await service.searchBooks('1984 Orwell');
    console.log('Search results:', JSON.stringify(searchResults, null, 2));

    if (searchResults.length > 0) {
      const firstBook = searchResults[0];
      console.log('\nTesting download link retrieval...');
      
      for (const format of firstBook.formats) {
        try {
          console.log(`\nTrying to get download link for format: ${format.format}`);
          const downloadLink = await service.getDownloadLink(firstBook.sourceUrl, format.format);
          console.log('Download link:', downloadLink);
        } catch (formatError) {
          console.error(`Error getting download link for format ${format.format}:`, formatError.message);
        }
      }
    }

    console.log('\nTesting cache...');
    console.log('Performing same search again (should be faster)...');
    const cachedResults = await service.searchBooks('1984 Orwell');
    console.log('Cache working:', cachedResults.length > 0);

  } catch (error) {
    console.error('Test failed:', error.message);
  }
}

// Run the test
testFlibustaService(); 
const mongoose = require('mongoose');
require('dotenv').config();

// Import the sanitizer from the route file (we'll duplicate it here for testing)
const sanitizeSnapshot = (snapshot) => {
  if (!snapshot || typeof snapshot !== 'object') return snapshot;
  let safe;
  try {
    safe = JSON.parse(JSON.stringify(snapshot));
  } catch (e) {
    return snapshot;
  }

  if (safe.document) {
    if (!Object.prototype.hasOwnProperty.call(safe.document, 'meta') || safe.document.meta == null) {
      safe.document.meta = {};
    }
  }

  const records = safe.store?.records;
  if (records && typeof records === 'object') {
    Object.entries(records).forEach(([id, record]) => {
      if (record && typeof record === 'object') {
        if (!Object.prototype.hasOwnProperty.call(record, 'meta') || record.meta == null) {
          record.meta = {};
          records[id] = record;
        }
      }
    });
  }

  return safe;
};

// Test function to check if a snapshot has missing meta
const hasMissingMeta = (snapshot) => {
  if (!snapshot || typeof snapshot !== 'object') return false;

  // Check document meta
  if (snapshot.document) {
    if (!('meta' in snapshot.document) || snapshot.document.meta == null || snapshot.document.meta === undefined) {
      return true;
    }
  }

  // Check all records
  const records = snapshot.store?.records;
  if (records && typeof records === 'object') {
    for (const record of Object.values(records)) {
      if (record && typeof record === 'object') {
        if (!('meta' in record) || record.meta == null || record.meta === undefined) {
          return true;
        }
      }
    }
  }

  return false;
};

async function testSanitizer() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected!\n');

    const TLMap = mongoose.model('TLMap', new mongoose.Schema({}, { strict: false }), 'tlmaps');
    
    const maps = await TLMap.find({}).lean();
    console.log(`Found ${maps.length} TL maps in database\n`);

    let brokenCount = 0;
    let fixedCount = 0;
    const issues = [];

    for (const map of maps) {
      const mapId = map._id.toString();
      const hasIssues = hasMissingMeta(map.snapshot);
      
      if (hasIssues) {
        brokenCount++;
        console.log(`❌ Map ${mapId} (${map.name || 'Untitled'}) has missing meta fields`);
        
        // Test sanitization
        const sanitized = sanitizeSnapshot(map.snapshot);
        const stillHasIssues = hasMissingMeta(sanitized);
        
        if (!stillHasIssues) {
          fixedCount++;
          console.log(`   ✓ Sanitizer fixes it`);
          
          // Optionally update in database (commented out for safety)
          // await TLMap.updateOne({ _id: map._id }, { $set: { snapshot: sanitized } });
          // console.log(`   ✓ Fixed in database`);
        } else {
          console.log(`   ✗ Sanitizer did NOT fix it (unexpected!)`);
          issues.push(mapId);
        }
      } else {
        console.log(`✓ Map ${mapId} (${map.name || 'Untitled'}) looks clean`);
      }
    }

    console.log(`\n=== Summary ===`);
    console.log(`Total maps: ${maps.length}`);
    console.log(`Maps with issues: ${brokenCount}`);
    console.log(`Maps that sanitizer can fix: ${fixedCount}`);
    if (issues.length > 0) {
      console.log(`Maps that sanitizer CANNOT fix: ${issues.length}`);
      console.log(`Problematic map IDs: ${issues.join(', ')}`);
    }

    await mongoose.disconnect();
    console.log('\nDone!');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

testSanitizer();

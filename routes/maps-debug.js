/**
 * Maps Debugging Utilities
 * 
 * This file contains helper functions for debugging map-related issues
 */

// Debug line elements in a map
const debugLineElements = (map) => {
  console.log('\n====== DEBUG LINE ELEMENTS ======');
  
  try {
    // Check if map is properly structured
    if (!map) {
      console.log('Map is null or undefined');
      return;
    }
    
    if (!map.elements || !Array.isArray(map.elements)) {
      console.log('Map elements array is missing or not an array:', map.elements);
      return;
    }
    
    // Extract line elements
    const lineElements = map.elements.filter(el => el.type === 'line');
    console.log(`Found ${lineElements.length} line elements`);
    
    if (lineElements.length === 0) {
      console.log('No line elements found in map');
      return;
    }
    
    // Analyze each line element
    lineElements.forEach((line, index) => {
      console.log(`\nLine Element #${index + 1}:`);
      console.log('ID:', line.id);
      console.log('Base properties:', {
        left: line.left, 
        top: line.top,
        text: line.text,
        orientation: line.orientation
      });
      
      // Check lineData
      if (!line.lineData) {
        console.log('ERROR: lineData property is missing');
      } else {
        console.log('lineData:', line.lineData);
        
        // Check required coordinates
        const requiredProps = ['startX', 'startY', 'endX', 'endY'];
        const missingProps = requiredProps.filter(prop => typeof line.lineData[prop] !== 'number');
        
        if (missingProps.length > 0) {
          console.log(`ERROR: Missing or invalid required properties: ${missingProps.join(', ')}`);
        }
        
        // Check for NaN or infinite values
        requiredProps.forEach(prop => {
          const value = line.lineData[prop];
          if (typeof value === 'number' && (Number.isNaN(value) || !Number.isFinite(value))) {
            console.log(`ERROR: Property ${prop} has invalid value: ${value}`);
          }
        });
        
        // Check for extra properties
        const extraProps = Object.keys(line.lineData).filter(key => !requiredProps.includes(key));
        if (extraProps.length > 0) {
          console.log(`WARN: Extra properties found: ${extraProps.join(', ')}`);
        }
      }
    });
  } catch (error) {
    console.error('Error in debugLineElements:', error);
  }
  
  console.log('====== END DEBUG LINE ELEMENTS ======\n');
};

// Analyze and validate map structure before saving
const validateMapStructure = (map) => {
  console.log('\n====== VALIDATE MAP STRUCTURE ======');
  
  try {
    // Check required top-level properties
    const requiredProps = ['name', 'elements', 'connections', 'canvasPosition', 'scale'];
    const missingProps = requiredProps.filter(prop => map[prop] === undefined);
    
    if (missingProps.length > 0) {
      console.log(`Missing required properties: ${missingProps.join(', ')}`);
    }
    
    // Check elements array
    if (!Array.isArray(map.elements)) {
      console.log('Elements is not an array:', map.elements);
    } else {
      console.log(`Map contains ${map.elements.length} elements`);
      
      // Count element types
      const typeCounts = map.elements.reduce((counts, el) => {
        counts[el.type] = (counts[el.type] || 0) + 1;
        return counts;
      }, {});
      
      console.log('Element types:', typeCounts);
      
      // Check for required element properties
      const elementMissingProps = [];
      map.elements.forEach((el, index) => {
        const required = ['id', 'type', 'left', 'top', 'text', 'orientation'];
        const missing = required.filter(prop => el[prop] === undefined);
        
        if (missing.length > 0) {
          elementMissingProps.push({
            index,
            id: el.id || `element-${index}`,
            type: el.type || 'unknown',
            missingProps: missing
          });
        }
      });
      
      if (elementMissingProps.length > 0) {
        console.log('Elements with missing properties:', elementMissingProps);
      }
    }
    
  } catch (error) {
    console.error('Error in validateMapStructure:', error);
  }
  
  console.log('====== END VALIDATE MAP STRUCTURE ======\n');
};

module.exports = {
  debugLineElements,
  validateMapStructure
};

const PROJECT_ID = "studio-2604127518-57889";
const BASE_URL = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

/**
 * Recursively parses a Firestore REST API Value object into a normal JS value.
 */
export function parseFirestoreValue(val: any): any {
  if (val === null || val === undefined) return null;
  if ('stringValue' in val) return val.stringValue;
  if ('booleanValue' in val) return val.booleanValue;
  if ('integerValue' in val) return parseInt(val.integerValue, 10);
  if ('doubleValue' in val) return val.doubleValue;
  if ('timestampValue' in val) return val.timestampValue;
  if ('mapValue' in val) {
    const fields = val.mapValue.fields || {};
    const obj: any = {};
    for (const [key, value] of Object.entries(fields)) {
      obj[key] = parseFirestoreValue(value);
    }
    return obj;
  }
  if ('arrayValue' in val) {
    const values = val.arrayValue.values || [];
    return values.map((v: any) => parseFirestoreValue(v));
  }
  if ('nullValue' in val) return null;
  return val;
}

/**
 * Parses a complete Firestore REST API Document response into a normal JS object.
 */
export function parseFirestoreDocument(doc: any): any {
  if (!doc || !doc.fields) return null;
  const data: any = {};
  for (const [key, value] of Object.entries(doc.fields)) {
    data[key] = parseFirestoreValue(value);
  }
  
  // Extract document ID from name path: "projects/.../databases/(default)/documents/collection/id"
  const nameParts = doc.name ? doc.name.split('/') : [];
  data.id = nameParts[nameParts.length - 1];
  data.uid = data.id;
  
  return data;
}

/**
 * Fetches a single document from Firestore using the REST API.
 */
export async function fetchDocumentRest(collectionName: string, docId: string): Promise<any | null> {
  const url = `${BASE_URL}/${collectionName}/${docId}`;
  try {
    const res = await fetch(url, {
      next: { revalidate: 60 } // Cache document for 60 seconds using Next.js native fetch cache
    });

    if (!res.ok) {
      if (res.status === 404) {
        console.warn(`Firestore REST: Document not found at ${collectionName}/${docId}`);
        return null;
      }
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }

    const docJson = await res.json();
    return parseFirestoreDocument(docJson);
  } catch (error) {
    console.error(`Firestore REST Error fetching ${collectionName}/${docId}:`, error);
    return null;
  }
}

/**
 * Runs a structured query on a collection using the Firestore REST API.
 */
export async function runQueryRest(collectionName: string, structuredQuery: any): Promise<any[]> {
  const url = `${BASE_URL}:runQuery`;
  try {
    const queryBody = {
      structuredQuery: {
        from: [{ collectionId: collectionName }],
        ...structuredQuery
      }
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(queryBody),
      next: { revalidate: 30 } // Cache queries for 30 seconds
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }

    const results = await res.json();
    if (!Array.isArray(results)) {
      return [];
    }

    return results
      .filter((item: any) => item.document)
      .map((item: any) => parseFirestoreDocument(item.document));
  } catch (error) {
    console.error(`Firestore REST Error running query on ${collectionName}:`, error);
    return [];
  }
}

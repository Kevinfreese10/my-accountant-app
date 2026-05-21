'use server';

const PROJECT_ID = "studio-2604127518-57889";
const BASE_URL = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

/**
 * Gets the next sequential order ID from a dedicated counter in Firestore.
 * @returns {Promise<string>} The next order ID as a string.
 */
export async function getNextOrderId(): Promise<string> {
  const url = `${BASE_URL}/sequences/orders`;

  try {
    // 1. Fetch current value bypassing Next.js cache completely
    const getRes = await fetch(url, {
      method: 'GET',
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      },
      cache: 'no-store'
    });

    let currentVal = 9400;

    if (getRes.ok) {
      const docData = await getRes.json();
      const dbVal = docData?.fields?.current?.integerValue;
      if (dbVal !== undefined) {
        currentVal = parseInt(dbVal, 10);
      }
    } else if (getRes.status !== 404) {
      console.warn(`Firestore REST GET returned status ${getRes.status}`);
    }

    // 2. Increment the value
    const newVal = currentVal + 1;

    // 3. Update the database value via PATCH
    const patchUrl = `${url}?updateMask.fieldPaths=current`;
    const patchBody = {
      fields: {
        current: {
          integerValue: newVal.toString()
        }
      }
    };

    const patchRes = await fetch(patchUrl, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      },
      body: JSON.stringify(patchBody),
      cache: 'no-store'
    });

    if (!patchRes.ok) {
      const errorText = await patchRes.text();
      throw new Error(`PATCH failed with status ${patchRes.status}: ${errorText}`);
    }

    return newVal.toString();
  } catch (e) {
    console.error("Transaction/REST sequence generation failed: ", e);
    // Fallback to a timestamp-based ID in case of failure
    // to ensure order creation doesn't completely fail.
    return `ERR-${Date.now()}`;
  }
}


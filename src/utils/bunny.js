// import CryptoJS from 'crypto-js'; // ✅ Correct import

// const BUNNY_API_KEY = process.env.BUNNY_API_KEY;
// const BUNNY_LIBRARY_ID = process.env.BUNNY_LIBRARY_ID;
// const BUNNY_HOSTNAME = process.env.BUNNY_LIBRARY_HOSTNAME;
// const BUNNY_SIGNING_KEY = process.env.BUNNY_SIGNING_KEY;
// const DOMAIN = process.env.FRONTEND_URL.replace('https://', '');

// import crypto from 'crypto-js';

// export async function createBunnyVideo(title) {
//   const res = await fetch(`https://video.bunnycdn.com/library/${BUNNY_LIBRARY_ID}/videos`, {
//     method: 'POST',
//     headers: { 'AccessKey': BUNNY_API_KEY, 'Content-Type': 'application/json' },
//     body: JSON.stringify({ title })
//   });

//   const data = await res.json();
//   const guid = data.guid; // make sure this matches Bunny response

//   if (!guid) throw new Error('Bunny did not return a guid.');

//   const expiration = Math.floor(Date.now() / 1000) + 3600;
//   const signature = crypto.SHA256(BUNNY_LIBRARY_ID + BUNNY_SIGNING_KEY + expiration + guid)
//     .toString(crypto.enc.Hex);

//   return {
//     guid,
//     tusUrl: 'https://video.bunnycdn.com/tusupload',
//     headers: {
//       LibraryId: BUNNY_LIBRARY_ID,
//       AuthorizationSignature: signature,
//       AuthorizationExpire: expiration.toString(),
//       VideoId: guid,
//     },
//   };
// }

// export function generateBunnySignedUrl(guid, expiresInMinutes = 120) {
//   const expires = Math.floor(Date.now() / 1000) + (expiresInMinutes * 60);
//   const tokenString = `${BUNNY_SIGNING_KEY}${guid}${expires}`;
//   const token = crypto.MD5(tokenString).toString(crypto.enc.Hex);
//   // comment allowed domain for later
// //   return `https://${BUNNY_HOSTNAME}/${guid}.m3u8?token=${token}&expires=${expires}&allowed_domains=${DOMAIN}`;
//   return `https://${BUNNY_HOSTNAME}/${guid}.m3u8?token=${token}&expires=${expires}`;
// }





// import CryptoJS from 'crypto-js';

// const BUNNY_API_KEY = process.env.BUNNY_API_KEY;
// const BUNNY_LIBRARY_ID = process.env.BUNNY_LIBRARY_ID;
// const BUNNY_HOSTNAME = process.env.BUNNY_LIBRARY_HOSTNAME;
// const BUNNY_SIGNING_KEY = process.env.BUNNY_SIGNING_KEY;
// const DOMAIN = process.env.FRONTEND_URL?.replace('https://', '');


// export async function createBunnyVideo(title) {
//   const res = await fetch(`https://video.bunnycdn.com/library/${BUNNY_LIBRARY_ID}/videos`, {
//     method: 'POST',
//     headers: { 
//       'AccessKey': BUNNY_API_KEY, 
//       'Content-Type': 'application/json' 
//     },
//     body: JSON.stringify({ title })
//   });

//   const data = await res.json();
//   const guid = data.guid;

//   // Generate expiration (1 hour from now)
//   const expiration = Math.floor(Date.now() / 1000) + 3600;
  
//   // CORRECT signature format for Bunny TUS uploads
//   const signatureString = `${BUNNY_SIGNING_KEY}${expiration}`;
//   const signature = CryptoJS.SHA256(signatureString).toString(CryptoJS.enc.Hex);

//   return {
//     guid,
//     tusUrl: 'https://video.bunnycdn.com/tusupload',
//     headers: {
//       'LibraryId': BUNNY_LIBRARY_ID,
//       'AuthorizationSignature': signature,
//       'AuthorizationExpire': expiration.toString(),
//       'VideoId': guid,
//     },
//   };
// }

// export function generateBunnySignedUrl(guid, expiresInMinutes = 120) {
//   const expires = Math.floor(Date.now() / 1000) + (expiresInMinutes * 60);
//   const tokenString = `${BUNNY_SIGNING_KEY}${guid}${expires}`;
//   const token = CryptoJS.MD5(tokenString).toString(CryptoJS.enc.Hex);
  
//   // Domain restriction is optional but recommended for security
//   if (DOMAIN) {
//     return `https://${BUNNY_HOSTNAME}/${guid}.m3u8?token=${token}&expires=${expires}&allowed_domains=${DOMAIN}`;
//   }
  
//   return `https://${BUNNY_HOSTNAME}/${guid}.m3u8?token=${token}&expires=${expires}`;
// }




import CryptoJS from "crypto-js";
import crypto from "crypto";


// Environment variables
const BUNNY_API_KEY = process.env.BUNNY_API_KEY;
const BUNNY_LIBRARY_ID = process.env.BUNNY_LIBRARY_ID;
const BUNNY_HOSTNAME = process.env.BUNNY_LIBRARY_HOSTNAME;
const BUNNY_SIGNING_KEY = process.env.BUNNY_SIGNING_KEY;

// export async function createBunnyVideo(title) {
//   try {
//     const res = await fetch(
//       `https://video.bunnycdn.com/library/${BUNNY_LIBRARY_ID}/videos`,
//       {
//         method: "POST",
//         headers: {
//           AccessKey: BUNNY_API_KEY,
//           "Content-Type": "application/json",
//         },
//         body: JSON.stringify({ title }),
//       }
//     );

//     if (!res.ok) {
//       throw new Error(`فشل إنشاء الفيديو: ${res.status} ${res.statusText}`);
//     }

//     const data = await res.json();
//     const guid = data.guid;

//     if (!guid) {
//       throw new Error("لم يتم إرجاع معرف الفيديو (guid) من Bunny");
//     }

//     const expiration = Math.floor(Date.now() / 1000) + 3600 * 24 * 7; // days
//     const signature = CryptoJS.SHA256(
//       BUNNY_LIBRARY_ID + BUNNY_API_KEY + expiration + guid
//     ).toString(CryptoJS.enc.Hex);

//     return {
//       guid,
//       tusUrl: "https://video.bunnycdn.com/tusupload",
//       headers: {
//         LibraryId: BUNNY_LIBRARY_ID,
//         AuthorizationSignature: signature,
//         AuthorizationExpire: expiration.toString(),
//         VideoId: guid,
//       },
//     };
//   } catch (err) {
//     console.error("createBunnyVideo error:", err.message);
//     throw err;
//   }
// }


const SECONDS_IN_DAY = 3600 * 24;
const DEFAULT_MAX_EXPIRY_SECONDS = 7 * SECONDS_IN_DAY; // 7 days

export function generateBunnyAuthHeadersForGuid(guid, expireInSeconds = DEFAULT_MAX_EXPIRY_SECONDS) {
  const expiration = Math.floor(Date.now() / 1000) + expireInSeconds;
  // signature format: sha256(libraryId + apiKey + expiration + guid)
  const signature = crypto
    .createHash("sha256")
    .update(`${BUNNY_LIBRARY_ID}${BUNNY_API_KEY}${expiration}${guid}`)
    .digest("hex");

  return {
    LibraryId: BUNNY_LIBRARY_ID,
    AuthorizationSignature: signature,
    AuthorizationExpire: expiration.toString(),
    VideoId: guid,
    tusUrl: "https://video.bunnycdn.com/tusupload",
  };
}

export async function createBunnyVideo(title) {
  // existing POST to create video
  const res = await fetch(
    `https://video.bunnycdn.com/library/${BUNNY_LIBRARY_ID}/videos`,
    {
      method: "POST",
      headers: {
        AccessKey: BUNNY_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ title }),
    }
  );

  if (!res.ok) {
    throw new Error(`فشل إنشاء الفيديو: ${res.status} ${res.statusText}`);
  }

  const data = await res.json();
  const guid = data.guid;
  if (!guid) throw new Error("لم يتم إرجاع معرف الفيديو (guid) من Bunny");

  // Use helper to generate headers (7-day default)
  const { LibraryId, AuthorizationSignature, AuthorizationExpire, VideoId, tusUrl } =
    generateBunnyAuthHeadersForGuid(guid);

  return {
    guid,
    tusUrl,
    headers: { LibraryId, AuthorizationSignature, AuthorizationExpire, VideoId },
  };
}


import jwt from "jsonwebtoken";


export function generateBunnySignedUrl(guid, expiresInMinutes = 60) {
  try {
    const expires = Math.floor(Date.now() / 1000) + expiresInMinutes * 60 * 24 ; // 24 hours

    // Create JWT token with expiration only (same as working code)
    const token = jwt.sign({ exp: expires }, BUNNY_SIGNING_KEY, {
      algorithm: "HS256",
    });

    // Construct signed URL with guid (not filePath)
    return `https://${BUNNY_HOSTNAME}/${guid}/playlist.m3u8?token=${token}&expires=${expires}`;
  } catch (err) {
    console.error("generateBunnySignedUrl error:", err.message);
    throw new Error(`فشل إنشاء الرابط الموقّع: ${err.message}`);
  }
}
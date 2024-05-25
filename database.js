var admin = require("firebase-admin");

var serviceAccount = require("./magangtimah2024-firebase-adminsdk-kx3xp-1fb5aaae79.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://magangtimah2024-default-rtdb.firebaseio.com/",
});

const db = admin.database();
// Menulis data ke database
db.ref("test")
  .set({
    message: "Database terhubung!",
  })
  .then(() => {
    console.log("Data berhasil ditulis. Database terhubung.");
  })
  .catch((error) => {
    console.error("Gagal menulis data:", error);
  });

// Membaca data dari database
db.ref("test")
  .once("value")
  .then((snapshot) => {
    const data = snapshot.val();
    console.log("Data dari database:", data);
  })
  .catch((error) => {
    console.error("Gagal membaca data:", error);
  });

// db.ref("user")
//   .set({
//     username: "akbar1501",
//     email:"akbar@gmail.com",
//     password :"123456",
//   })
//   .then(() => {
//     console.log("Data berhasil ditulis.");
//   })
//   .catch((error) => {
//     console.error("Gagal menulis data:", error);
//   });

const express = require("express");
const bodyParser = require("body-parser");
const admin = require("firebase-admin");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");

const app = express();
const port = process.env.PORT || 5000;

// Inisialisasi Firebase Admin SDK
const serviceAccount = require("./magangtimah2024-firebase-adminsdk-kx3xp-1fb5aaae79.json");
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://magangtimah2024-default-rtdb.firebaseio.com/",
});
const db = admin.database();

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// function verifyToken(req, res, next) {
//   const token = req.headers["authorization"];
//   if (!token) return res.status(401).json({ error: "Unauthorized" });

//   jwt.verify(token, "your-secret-key", (err, decoded) => {
//     if (err) return res.status(401).json({ error: "Unauthorized" });
//     req.userId = decoded.userId;
//     next();
//   });
// }

function verifyToken(req, res, next) {
  const token = req.headers["authorization"];

  if (!token) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  // Verifikasi token
  jwt.verify(token, "your-secret-key", (err, decoded) => {
    if (err) {
      return res.status(401).json({ error: "Failed to authenticate token" });
    }

    const username = decoded.username;

    // Cari pengguna berdasarkan username di Firebase Realtime Database
    db.ref("users")
      .orderByChild("username")
      .equalTo(username)
      .once("value")
      .then((snapshot) => {
        const userData = snapshot.val();
        if (!userData) {
          return res.status(401).json({ error: "Invalid token" });
        }

        // Ambil data user pertama (asumsi username adalah unik)
        const userId = Object.keys(userData)[0];
        const user = userData[userId];

        // Periksa apakah token sesuai dengan yang tersimpan dalam data pengguna
        if (user.token !== token) {
          return res.status(401).json({ error: "Invalid token" });
        }

        // Simpan userId untuk digunakan di endpoint lain
        req.userId = userId;
        next();
      })
      .catch((error) => {
        console.error(error);
        res.status(500).json({ error: "Internal server error" });
      });
  });
}

app.post("/api/v1/login", (req, res) => {
  const { username, password } = req.body;

  // Cari user berdasarkan username di Firebase Realtime Database
  db.ref("users")
    .orderByChild("username")
    .equalTo(username)
    .once("value")
    .then((snapshot) => {
      const userData = snapshot.val();
      if (!userData) {
        return res.status(404).json({ error: "User not found" });
      }

      // Ambil data user pertama (asumsi username adalah unik)
      const userId = Object.keys(userData)[0];
      const user = userData[userId];

      // Periksa apakah token sudah ada dalam data pengguna
      if (user.token) {
        return res.status(401).json({ error: "You are already logged in!", token:user.token });
      }

      // Bandingkan password yang dimasukkan dengan password yang telah di-hash
      bcrypt.compare(password, user.password, (err, result) => {
        if (err) {
          return res.status(500).json({ error: "Internal server error" });
        }
        if (!result) {
          return res.status(401).json({ error: "Incorrect password" });
        }

        // Buat token baru
        const token = jwt.sign(
          { username: user.username, email: user.email },
          "your-secret-key"
        );

        // Simpan token baru ke dalam data pengguna
        user.token = token;
        user.loginTimestamp = Date.now();

        // Update data pengguna di Firebase Realtime Database
        db.ref("users").child(userId).set(user);

        // Kirimkan token baru sebagai respons
        res
          .status(200)
          .json({ success: true, message: "Login successful!", token });
      });
    })
    .catch((error) => {
      console.error(error);
      res.status(500).json({ error: "Internal server error" });
    });
});

// Endpoint proteksi
app.get("/api/v1/protected", verifyToken, (req, res) => {
  res.json({ message: "This is a protected route" });
});

app.post("/api/v1/protectedPost", verifyToken, (req, res) => {
  // Dapatkan data yang dikirimkan oleh pengguna
  const { namaLengkap, universitas, kelas, tanggalLahir, jurusan } = req.body;

  // Simpan data ke dalam database Firebase Realtime
  db.ref("data pribadi")
    .push({
      namaLengkap: namaLengkap,
      universitas: universitas,
      kelas: kelas,
      tanggalLahir: tanggalLahir,
      jurusan: jurusan,
    })
    .then(() => {
      res.json({
        success: true,
        message: "Data berhasil disimpan ke database",
      });
    })
    .catch((error) => {
      console.error(error);
      res.status(500).json({ error: "Gagal menyimpan data ke database" });
    });
});

app.post("/api/v1/register", (req, res) => {
  const { username, password, email } = req.body;

  // Cek apakah email sudah ada dalam database
  db.ref("users")
    .orderByChild("email")
    .equalTo(email)
    .once("value")
    .then((snapshot) => {
      if (snapshot.exists()) {
        return res.status(400).json({ error: "Email already exists" });
      }

      // Hash password menggunakan bcrypt
      bcrypt.hash(password, 10, (err, hashedPassword) => {
        if (err) {
          return res
            .status(500)
            .json({ message: "Internal server error", error: err });
        }

        // Buat token
        const token = jwt.sign(
          { username: username, email: email },
          "your-secret-key"
        );

        // Data user baru
        const userData = {
          username: username,
          email: email,
          password: hashedPassword,
          token: token, // Simpan token di dalam data pengguna
        };

        // Simpan data user baru ke Firebase Realtime Database
        db.ref("users")
          .push(userData)
          .then(() => {
            res
              .status(201)
              .json({ success: true, message: "Berhasil Register" });
          })
          .catch((error) => {
            console.error(error);
            res.status(500).json({ error: "Internal server error" });
          });
      });
    })
    .catch((error) => {
      console.error(error);
      res.status(500).json({ error: "Internal server error" });
    });
});

// Endpoint untuk mendapatkan semua data user
app.get("/api/v1/get_data", verifyToken, (req, res) => {
  const userId = req.userId; // Ambil ID pengguna dari token JWT

  // Ambil data pengguna berdasarkan ID dari Firebase Realtime Database
  db.ref(`users/${userId}`)
    .once("value")
    .then((snapshot) => {
      const userData = snapshot.val();
      if (!userData) return res.status(404).json({ error: "User not found" });
      res.status(200).json({ success: true, data: userData });
    })
    .catch((error) => {
      console.error(error);
      res.status(500).json({ error: "Internal server error" });
    });
});

// Endpoint untuk mendapatkan data user berdasarkan ID
// app.get("/api/v1/get_data/:id", verifyToken, (req, res) => {
//   const userId = req.params.id;

//   // Ambil data user dari Firebase Realtime Database berdasarkan ID
//   db.ref(`users/${userId}`)
//     .once("value")
//     .then((snapshot) => {
//       const user = snapshot.val();
//       if (!user) return res.status(404).json({ error: "User not found" });
//       res.status(200).json({ success: true, data: user });
//     })
//     .catch((error) => {
//       console.error(error);
//       res.status(500).json({ error: "Internal server error" });
//     });
// });

app.post("/api/v1/logout", (req, res) => {
  const { username, password } = req.body;

  // Cari user berdasarkan username di Firebase Realtime Database
  db.ref("users")
    .orderByChild("username")
    .equalTo(username)
    .once("value")
    .then((snapshot) => {
      const userData = snapshot.val();
      if (!userData) {
        return res.status(404).json({ error: "User not found" });
      }

      // Ambil data user pertama (asumsi username adalah unik)
      const userId = Object.keys(userData)[0];
      const user = userData[userId];

      // Bandingkan password yang dimasukkan dengan password yang disimpan dalam database
      bcrypt.compare(password, user.password, (err, result) => {
        if (err) {
          return res.status(500).json({ error: "Internal server error" });
        }
        if (!result) {
          return res.status(401).json({ error: "Incorrect password" });
        }

        // Periksa apakah token sudah dihapus dari data pengguna
        if (!user.token) {
          return res.json({
            message: "You are already logged out!",
          });
        }

        // Hapus token dari data pengguna
        delete user.token;
        delete user.loginTimestamp;

        // Update data pengguna di Firebase Realtime Database
        db.ref("users").child(userId).set(user);

        // Berhasil logout
        res.json({ success: true, message: "Logout successful" });
      });
    })
    .catch((error) => {
      console.error(error);
      res.status(500).json({ error: "Internal server error" });
    });
});

// Menjalankan server
app.listen(port, () => console.log(`Server running at port: ${port}`));

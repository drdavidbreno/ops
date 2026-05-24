(() => {
  const firebaseConfig = {
    apiKey: "AIzaSyBulTomdHV1TL5MPa-5fLCKXUAHiSL0Zcc",
    authDomain: "site-casamento-7e66a.firebaseapp.com",
    projectId: "site-casamento-7e66a",
    storageBucket: "site-casamento-7e66a.firebasestorage.app",
    messagingSenderId: "378703321412",
    appId: "1:378703321412:web:ab1daab40ffd7dd16f5f11",
    measurementId: "G-DG9EECRLGR"
  };

  let initPromise;

  async function init() {
    if (!initPromise) {
      initPromise = Promise.all([
        import("https://www.gstatic.com/firebasejs/12.13.0/firebase-app.js"),
        import("https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js"),
        import("https://www.gstatic.com/firebasejs/12.13.0/firebase-storage.js")
      ]).then(([appMod, firestoreMod, storageMod]) => {
        const app = appMod.getApps().length
          ? appMod.getApp()
          : appMod.initializeApp(firebaseConfig);

        return {
          app,
          db: firestoreMod.getFirestore(app),
          storage: storageMod.getStorage(app),
          firestore: firestoreMod,
          storageMod
        };
      });
    }

    return initPromise;
  }

  function isPlainObject(value) {
    return value && typeof value === "object" && !Array.isArray(value);
  }

  function cleanForFirestore(value) {
    if (Array.isArray(value)) {
      return value
        .map(cleanForFirestore)
        .filter((item) => item !== undefined);
    }

    if (isPlainObject(value)) {
      return Object.fromEntries(
        Object.entries(value)
          .map(([key, item]) => [key, cleanForFirestore(item)])
          .filter(([, item]) => item !== undefined)
      );
    }

    if (typeof value === "string" && value.startsWith("data:") && value.length > 700000) {
      return undefined;
    }

    return value;
  }

  function dataUrlToBlob(dataUrl) {
    const [meta, raw] = String(dataUrl).split(",");
    const mime = meta.match(/data:(.*?);base64/)?.[1] || "image/png";
    const binary = atob(raw || "");
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    return new Blob([bytes], { type: mime });
  }

  async function getSite(slug) {
    if (!slug) return null;
    try {
      const { db, firestore } = await init();
      const snap = await firestore.getDoc(firestore.doc(db, "sites", slug));
      return snap.exists() ? snap.data() : null;
    } catch (error) {
      console.warn("Firebase: nao foi possivel buscar o site.", error);
      return null;
    }
  }

  async function saveSite(site) {
    if (!site?.slug) return false;
    try {
      const { db, firestore } = await init();
      const payload = cleanForFirestore({
        ...site,
        updatedAt: new Date().toISOString()
      });
      await firestore.setDoc(firestore.doc(db, "sites", site.slug), payload, { merge: true });
      return true;
    } catch (error) {
      console.warn("Firebase: nao foi possivel salvar o site.", error);
      return false;
    }
  }

  async function replaceSiteSlug(oldSlug, newSlug, site) {
    if (!newSlug) return false;
    try {
      const { db, firestore } = await init();
      const nextSite = cleanForFirestore({
        ...(site || {}),
        slug: newSlug,
        updatedAt: new Date().toISOString()
      });
      await firestore.setDoc(firestore.doc(db, "sites", newSlug), nextSite, { merge: true });
      if (oldSlug && oldSlug !== newSlug) {
        await firestore.deleteDoc(firestore.doc(db, "sites", oldSlug));
      }
      return true;
    } catch (error) {
      console.warn("Firebase: nao foi possivel trocar o endereco.", error);
      return false;
    }
  }

  async function uploadSiteImage(slug, field, dataUrl) {
    if (!slug || !dataUrl || !String(dataUrl).startsWith("data:")) return dataUrl || "";
    try {
      const { storage, storageMod } = await init();
      const blob = dataUrlToBlob(dataUrl);
      const extension = blob.type.split("/")[1] || "png";
      const path = `sites/${slug}/${field}-${Date.now()}.${extension}`;
      const imageRef = storageMod.ref(storage, path);
      await storageMod.uploadBytes(imageRef, blob, { contentType: blob.type });
      return await storageMod.getDownloadURL(imageRef);
    } catch (error) {
      console.warn("Firebase: nao foi possivel enviar a imagem.", error);
      return dataUrl;
    }
  }

  async function listCollection(slug, collectionName) {
    if (!slug) return [];
    try {
      const { db, firestore } = await init();
      const snap = await firestore.getDocs(firestore.collection(db, "sites", slug, collectionName));
      return snap.docs
        .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
        .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
    } catch (error) {
      console.warn(`Firebase: nao foi possivel ler ${collectionName}.`, error);
      return [];
    }
  }

  async function addCollectionItem(slug, collectionName, item) {
    if (!slug) return false;
    try {
      const { db, firestore } = await init();
      await firestore.addDoc(firestore.collection(db, "sites", slug, collectionName), {
        ...cleanForFirestore(item),
        createdAt: new Date().toISOString()
      });
      return true;
    } catch (error) {
      console.warn(`Firebase: nao foi possivel salvar ${collectionName}.`, error);
      return false;
    }
  }

  window.OpsFirebaseData = {
    ready: init,
    getSite,
    saveSite,
    replaceSiteSlug,
    uploadSiteImage,
    listGuests: (slug) => listCollection(slug, "guests"),
    addGuest: (slug, guest) => addCollectionItem(slug, "guests", guest),
    listNotes: (slug) => listCollection(slug, "notes"),
    addNote: (slug, note) => addCollectionItem(slug, "notes", note)
  };
})();

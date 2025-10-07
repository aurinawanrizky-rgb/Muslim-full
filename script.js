const CLIENT_ID = '544009583277-qd8po0m30sat4rnu83oitajs28n0g57h.apps.googleusercontent.com'; // ganti dengan Client ID Google-mu
const SCOPES = 'https://www.googleapis.com/auth/drive.file';

let tokenClient;
let accessToken = null;
let pendingNote = null;

const logForm = document.getElementById('logForm');
const reflectionInput = document.getElementById('reflection');
const entriesList = document.getElementById('entriesList');
const userIcon = document.getElementById('userIcon');

// -------------------- Google API Init --------------------
function gapiLoaded() {
  gapi.load('client', initializeGapiClient);
}

async function initializeGapiClient() {
  await gapi.client.init({
    apiKey: '',
    discoveryDocs: ["https://www.googleapis.com/discovery/v1/apis/drive/v3/rest"]
  });
}

function gisLoaded() {
  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: CLIENT_ID,
    scope: SCOPES,
    callback: handleTokenResponse
  });
}

// -------------------- Login callback --------------------
async function handleTokenResponse(resp) {
  if (resp.error) throw resp;
  accessToken = resp.access_token;

  try {
    const profileRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { 'Authorization': 'Bearer ' + accessToken }
    });
    const profile = await profileRes.json();

    // Ganti emoji dengan foto profil
    userIcon.innerHTML = '';
    const img = document.createElement('img');
    img.src = profile.picture;
    img.style.width = '40px';
    img.style.height = '40px';
    img.style.borderRadius = '50%';
    userIcon.appendChild(img);

  } catch (err) {
    console.log('Gagal ambil foto user:', err);
    userIcon.textContent = '❗'; // fallback tanda seru
  }

  await savePendingNote();
}

// -------------------- Save note functions --------------------
async function createOrGetFolder() {
  const folderName = 'MuslimFullNotes';
  const res = await gapi.client.drive.files.list({
    q: `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    fields: 'files(id, name)'
  });
  if (res.result.files && res.result.files.length > 0) {
    return res.result.files[0].id;
  } else {
    const folder = await gapi.client.drive.files.create({
      resource: {
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder'
      },
      fields: 'id'
    });
    return folder.result.id;
  }
}

async function saveNoteToDrive(text) {
  const folderId = await createOrGetFolder();
  const blob = new Blob([text], { type: 'text/plain' });
  const metadata = {
    name: `note_${new Date().toISOString()}.txt`,
    parents: [folderId]
  };

  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  form.append('file', blob);

  await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + accessToken },
    body: form
  });

  await listNotes();
}

async function listNotes() {
  const folderId = await createOrGetFolder();
  const res = await gapi.client.drive.files.list({
    q: `'${folderId}' in parents and trashed=false`,
    fields: 'files(id, name, createdTime)'
  });

  entriesList.innerHTML = '';
  if (!res.result.files || res.result.files.length === 0) {
    entriesList.innerHTML = '<li style="color: #555">Belum ada catatan.</li>';
    return;
  }

  res.result.files
    .sort((a,b)=>new Date(b.createdTime)-new Date(a.createdTime))
    .forEach(file=>{
      const li = document.createElement('li');
      li.textContent = `${new Date(file.createdTime).toLocaleString()} - ${file.name}`;
      entriesList.appendChild(li);
    });
}

// -------------------- Form Submit --------------------
logForm.addEventListener('submit', async (e)=>{
  e.preventDefault();
  const text = reflectionInput.value.trim();
  if (!text) return;

  if (accessToken) {
    await saveNoteToDrive(text);
  } else {
    pendingNote = text;
    tokenClient.requestAccessToken({ prompt: 'consent' });

    // ubah ikon sementara menjadi tanda seru
    userIcon.textContent = '❗';
    userIcon.innerHTML = '';
  }

  reflectionInput.value = '';
});

// -------------------- Save pending note setelah login --------------------
async function savePendingNote() {
  if (pendingNote) {
    await saveNoteToDrive(pendingNote);
    pendingNote = null;
  }
}

// -------------------- Init --------------------
window.onload = () => {
  gapiLoaded();
  if (window.google && google.accounts) {
    gisLoaded();
  } else {
    console.log('Google Identity Services belum siap');
  }
};
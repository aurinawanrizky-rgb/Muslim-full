const CLIENT_ID = '544009583277-qd8po0m30sat4rnu83oitajs28n0g57h.apps.googleusercontent.com';
const SCOPES = 'https://www.googleapis.com/auth/drive.file';

let tokenClient;
let accessToken = null;

const logForm = document.getElementById('logForm');
const reflectionInput = document.getElementById('reflection');
const entriesList = document.getElementById('entriesList');
const userIcon = document.getElementById('userIcon');

// ---------------- Google API & GIS ----------------
function gapiLoaded() { gapi.load('client', initializeGapiClient); }
async function initializeGapiClient() { 
  await gapi.client.init({ 
    apiKey:'', 
    discoveryDocs:['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'] 
  }); 
}

function gisLoaded() {
  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: CLIENT_ID,
    scope: SCOPES,
    callback: handleTokenResponse
  });
}

// ---------------- Login callback ----------------
async function handleTokenResponse(resp){
  if(resp.error) return;
  accessToken = resp.access_token;
  localStorage.setItem('google_access_token', accessToken);

  // update ikon segera setelah login
  await updateUserIcon();

  // load catatan
  await loadNotes();
}

// ---------------- Update user icon ----------------
async function updateUserIcon(){
  userIcon.innerHTML = ''; // bersihkan dulu
  if(!accessToken){
    userIcon.textContent = '❓';
    return;
  }

  try{
    const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers:{ 'Authorization':'Bearer '+accessToken }
    });
    const profile = await res.json();

    let el;
    if(profile.picture){
      el = document.createElement('img');
      el.src = profile.picture+'?sz=80';
    } else {
      el = document.createElement('div');
      el.textContent = profile.email[0].toUpperCase();
    }

    el.style.width='100%';
    el.style.height='100%';
    el.style.borderRadius='50%';
    el.style.cursor='pointer';
    userIcon.appendChild(el);

  }catch(e){
    console.log('Gagal ambil profil:', e);
    userIcon.textContent='❓';
  }
}

// ---------------- Event klik ikon ----------------
userIcon.addEventListener('click', ()=>{
  if(!accessToken) tokenClient.requestAccessToken({prompt:'consent'});
});

// ---------------- Drive ----------------
async function createFolder(){ 
  const res = await gapi.client.drive.files.list({ 
    q:`name='MuslimFullNotes' and mimeType='application/vnd.google-apps.folder' and trashed=false`, 
    fields:'files(id)' 
  });
  if(res.result.files?.length) return res.result.files[0].id;
  const folder = await gapi.client.drive.files.create({ 
    resource:{name:'MuslimFullNotes', mimeType:'application/vnd.google-apps.folder'}, 
    fields:'id' 
  });
  return folder.result.id;
}

async function saveNote(text){
  if(!accessToken){ tokenClient.requestAccessToken({prompt:'consent'}); return; }
  const folderId = await createFolder();
  const blob = new Blob([text],{type:'text/plain'});
  const metadata = { name:`note_${new Date().toISOString()}.txt`, parents:[folderId] };
  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(metadata)],{type:'application/json'}));
  form.append('file', blob);
  await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id', {
    method:'POST',
    headers:{'Authorization':'Bearer '+accessToken},
    body:form
  });
  await loadNotes();
}

async function loadNotes(){
  if(!accessToken) return;
  const folderId = await createFolder();
  const res = await gapi.client.drive.files.list({
    q:`'${folderId}' in parents and trashed=false`,
    fields:'files(id,name,createdTime)'
  });

  entriesList.innerHTML='';
  if(!res.result.files?.length){ 
    entriesList.innerHTML='<li style="color:#555">Belum ada catatan.</li>'; 
    return; 
  }

  const files = res.result.files.sort((a,b)=>new Date(b.createdTime)-new Date(a.createdTime));
  for(const file of files){
    try{
      const contentRes = await fetch(`https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`, {
        headers:{'Authorization':'Bearer '+accessToken}
      });
      const text = await contentRes.text();
      const li = document.createElement('li');
      li.textContent=`${new Date(file.createdTime).toLocaleString()} - ${text}`;
      entriesList.appendChild(li);
    }catch(e){ console.log(e); }
  }
}

// ---------------- Form submit ----------------
logForm.addEventListener('submit', async e=>{
  e.preventDefault();
  const text = reflectionInput.value.trim();
  if(!text) return;
  await saveNote(text);
  reflectionInput.value='';
});

// ---------------- On load ----------------
window.onload=async()=>{
  gapiLoaded();
  if(window.google && google.accounts) gisLoaded();
  const savedToken = localStorage.getItem('google_access_token');
  if(savedToken){ 
    accessToken=savedToken; 
    await updateUserIcon(); 
    await loadNotes(); 
  }
};
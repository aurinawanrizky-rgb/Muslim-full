const CLIENT_ID = '544009583277-qd8po0m30sat4rnu83oitajs28n0g57h.apps.googleusercontent.com';
const SCOPES = 'https://www.googleapis.com/auth/drive.file';

let profile = null;
let accessToken = null;
let tokenClient = null;

const logForm = document.getElementById('logForm');
const reflectionInput = document.getElementById('reflection');
const entriesList = document.getElementById('entriesList');
const userIcon = document.getElementById('userIcon');

const viewNotesBtn = document.getElementById('viewNotesBtn');
const backBtn = document.getElementById('backBtn');
const logSection = document.querySelector('.log-section');
const entriesSection = document.getElementById('entriesSection');

// ---------------- Toast popup ----------------
function showToast(message, type='info'){
  const toast = document.createElement('div');
  toast.textContent = message;
  toast.style.position = 'fixed';
  toast.style.top = '20px';
  toast.style.right = '20px';
  toast.style.padding = '10px 15px';
  toast.style.backgroundColor = type === 'success' ? '#4CAF50' 
                           : type === 'error' ? '#f44336' 
                           : '#2196F3';
  toast.style.color = 'white';
  toast.style.borderRadius = '5px';
  toast.style.boxShadow = '0 2px 6px rgba(0,0,0,0.2)';
  toast.style.zIndex = 9999;
  toast.style.opacity = '0';
  toast.style.transition = 'opacity 0.3s';

  document.body.appendChild(toast);
  requestAnimationFrame(() => toast.style.opacity = '1');

  setTimeout(()=>{
    toast.style.opacity = '0';
    setTimeout(()=> toast.remove(), 300);
  }, 3000);
}

// ---------------- Parse JWT ----------------
function parseJwt(token) {
  const base64Url = token.split('.')[1];
  const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  return JSON.parse(atob(base64));
}

// ---------------- Update ikon ----------------
function updateUserIcon(){
  userIcon.innerHTML = '';
  if(profile?.picture){
    const img = document.createElement('img');
    img.src = profile.picture + '?sz=80';
    userIcon.appendChild(img);
  } else if(profile?.email){
    const div = document.createElement('div');
    div.textContent = profile.email[0].toUpperCase();
    userIcon.appendChild(div);
  } else {
    userIcon.textContent = '❓';
  }
}

// ---------------- GIS callback ----------------
function handleCredentialResponse(response){
  profile = parseJwt(response.credential);
  localStorage.setItem('google_profile', JSON.stringify(profile));
  updateUserIcon();
  showToast('Login berhasil!', 'success');
  if(tokenClient) tokenClient.requestAccessToken({prompt:''});
}

// ---------------- Load GAPI ----------------
function gapiLoaded() { 
  gapi.load('client', initGapiClient); 
}

async function initGapiClient(){
  try{
    await gapi.client.init({
      apiKey: '',
      discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest']
    });

    const savedToken = localStorage.getItem('google_access_token');
    if(savedToken){
      accessToken = savedToken;
      await loadNotes();
      showToast('Catatan dimuat dari Drive', 'info');
    }
  }catch(e){ showToast('GAPI init error: '+e, 'error'); }
}

// ---------------- Klik ikon ----------------
userIcon.addEventListener('click', ()=>{
  if(!profile){
    google.accounts.id.prompt(); 
  } else if(!accessToken){
    tokenClient.requestAccessToken({prompt:'consent'});
  }
});

// ---------------- Token Client ----------------
function gisLoaded(){
  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: CLIENT_ID,
    scope: SCOPES,
    callback: async (resp)=>{
      if(resp.error){
        showToast('Token error: '+resp.error, 'error');
        return;
      }
      accessToken = resp.access_token;
      localStorage.setItem('google_access_token', accessToken);
      showToast('Token berhasil diterima', 'success');
      await loadNotes();
    }
  });
}

// ---------------- Drive ----------------
async function createFolder(){ 
  try{
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
  }catch(e){ showToast('Create folder error: '+e, 'error'); }
}

async function saveNote(text){
  if(!profile){ google.accounts.id.prompt(); return; }
  if(!accessToken){ tokenClient.requestAccessToken({prompt:'consent'}); return; }

  try{
    const folderId = await createFolder();
    const blob = new Blob([text], {type:'text/plain'});
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
    showToast('Catatan tersimpan!', 'success');
    
  }catch(e){ 
    showToast('Save note error: '+e, 'error'); 
  }
}

// ---------------- Load catatan ----------------
async function loadNotes(){
  if(!profile || !accessToken) return;

  try{
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
        li.textContent = `${new Date(file.createdTime).toLocaleString()} - ${text}`;
        li.title = text;
        entriesList.appendChild(li);
      }catch(e){ showToast('Load file error: '+e, 'error'); }
    }
  }catch(e){ showToast('Load notes error: '+e, 'error'); }
}

// ---------------- Form submit ----------------
logForm.addEventListener('submit', async e=>{
  e.preventDefault();
  const text = reflectionInput.value.trim();
  if(!text) return;
  await saveNote(text);
  reflectionInput.value='';
});

// ---------------- Tombol Catatan Sebelumnya ----------------
viewNotesBtn.addEventListener('click', async () => {
  if(!profile){ 
    google.accounts.id.prompt(); 
    return;
  }
  if(!accessToken){ 
    tokenClient.requestAccessToken({prompt:'consent'}); 
    return;
  }

  logSection.style.display = 'none';
  entriesSection.style.display = 'block';

  await loadNotes();
});

backBtn.addEventListener('click', () => {
  entriesSection.style.display = 'none';
  logSection.style.display = 'block';
});

// ---------------- On load ----------------
window.onload = ()=>{
  const savedProfile = localStorage.getItem('google_profile');
  if(savedProfile){
    profile = JSON.parse(savedProfile);
    updateUserIcon();
    gapiLoaded();
  }

  google.accounts.id.initialize({
    client_id: CLIENT_ID,
    callback: handleCredentialResponse
  });
  google.accounts.id.renderButton(document.createElement('div'), { theme:'outline', size:'small' });

  gisLoaded();
};
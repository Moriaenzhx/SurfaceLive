const {contextBridge,ipcRenderer}=require('electron');
if(process.isMainFrame)contextBridge.exposeInMainWorld('studio',{
  state:()=>ipcRenderer.invoke('studio:state'),
  storageInfo:id=>ipcRenderer.invoke('studio:storage-info',id),
  openFolder:(kind,value)=>ipcRenderer.invoke('studio:open-folder',kind,value),
  chooseStorage:()=>ipcRenderer.invoke('studio:choose-storage'),
  refresh:()=>ipcRenderer.invoke('studio:refresh'),
  direction:(text,target)=>ipcRenderer.invoke('studio:direction',text,target),
  start:input=>ipcRenderer.invoke('studio:start',input),
  reference:(id,index)=>ipcRenderer.invoke('studio:reference',id,index),
  inspect:(base,command,arg)=>ipcRenderer.invoke('studio:inspect',base,command,arg),
  saveEdit:input=>ipcRenderer.invoke('studio:save-edit',input),
  capture:rect=>ipcRenderer.invoke('studio:capture',rect),
  cancel:()=>ipcRenderer.invoke('studio:cancel'),
  export:id=>ipcRenderer.invoke('studio:export',id),
  onPreviewIssue:callback=>ipcRenderer.on('studio:preview-issue',(_event,issue)=>callback(issue)),
  onState:callback=>ipcRenderer.on('studio:state',(_event,state)=>callback(state))
});

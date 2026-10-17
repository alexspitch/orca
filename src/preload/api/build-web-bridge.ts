import { ipcRenderer } from 'electron'
import type { PreloadApi } from '../api-types'

export const buildWebApi = {
  status: () => ipcRenderer.invoke('buildWeb:status'),
  connect: (args) => ipcRenderer.invoke('buildWeb:connect', args),
  disconnect: () => ipcRenderer.invoke('buildWeb:disconnect'),
  testConnection: () => ipcRenderer.invoke('buildWeb:testConnection'),
  listIssues: (args) => ipcRenderer.invoke('buildWeb:listIssues', args),
  getIssue: (args) => ipcRenderer.invoke('buildWeb:getIssue', args),
  listAssignees: () => ipcRenderer.invoke('buildWeb:listAssignees'),
  listVersions: (args) => ipcRenderer.invoke('buildWeb:listVersions', args),
  updateIssue: (args) => ipcRenderer.invoke('buildWeb:updateIssue', args),
  setFavorite: (args) => ipcRenderer.invoke('buildWeb:setFavorite', args),
  addComment: (args) => ipcRenderer.invoke('buildWeb:addComment', args),
  setAgentSession: (args) => ipcRenderer.invoke('buildWeb:setAgentSession', args),
  noteProviderSession: (args) => ipcRenderer.invoke('buildWeb:noteProviderSession', args),
  clearAgentSession: (args) => ipcRenderer.invoke('buildWeb:clearAgentSession', args),
  imageSummary: () => ipcRenderer.invoke('buildWeb:imageSummary'),
  listImages: (args) => ipcRenderer.invoke('buildWeb:listImages', args),
  listImageBuilds: (args) => ipcRenderer.invoke('buildWeb:listImageBuilds', args),
  pushImages: (args) => ipcRenderer.invoke('buildWeb:pushImages', args)
} satisfies PreloadApi['buildWeb']

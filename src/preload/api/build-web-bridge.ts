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
  pushImages: (args) => ipcRenderer.invoke('buildWeb:pushImages', args),
  versionBranches: (args) => ipcRenderer.invoke('buildWeb:versionBranches', args),
  startImageBuild: (args) => ipcRenderer.invoke('buildWeb:startImageBuild', args),
  getRun: (args) => ipcRenderer.invoke('buildWeb:getRun', args),
  getIssueRun: (args) => ipcRenderer.invoke('buildWeb:getIssueRun', args),
  pushRun: (args) => ipcRenderer.invoke('buildWeb:pushRun', args),
  saveGuide: (args) => ipcRenderer.invoke('buildWeb:saveGuide', args),
  refreshGuideImages: (args) => ipcRenderer.invoke('buildWeb:refreshGuideImages', args),
  publishGuide: (args) => ipcRenderer.invoke('buildWeb:publishGuide', args),
  issueCommits: (args) => ipcRenderer.invoke('buildWeb:issueCommits', args),
  commitDiff: (args) => ipcRenderer.invoke('buildWeb:commitDiff', args),
  guideShot: (args) => ipcRenderer.invoke('buildWeb:guideShot', args)
} satisfies PreloadApi['buildWeb']

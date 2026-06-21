export function folderOpenCommand(platform = process.platform, folderPath = '') {
  if (platform === 'darwin') {
    return { command: 'open', args: [folderPath] };
  }
  if (platform === 'win32') {
    return { command: 'explorer.exe', args: [folderPath] };
  }
  if (platform === 'linux') {
    return { command: 'xdg-open', args: [folderPath] };
  }
  return null;
}

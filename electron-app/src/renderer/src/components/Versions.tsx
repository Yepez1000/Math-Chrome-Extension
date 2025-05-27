import { useState } from 'react'

export function Versions(): React.JSX.Element {
  const [versions] = useState(process.versions)

  return (
    <div className="versions">
      <span>Electron v{versions.electron}</span>
      <span>Chrome v{versions.chrome}</span>
      <span>Node v{versions.node}</span>
    </div>
  )
}

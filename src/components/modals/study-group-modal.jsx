import { Modal } from 'antd'
import { StudyGroupPanel } from '../study-group-panel.jsx'

export function StudyGroupModal({ token, open, onClose }) {
  return (
    <Modal open={open} onCancel={onClose} footer={null} width={720} centered destroyOnHidden>
      <StudyGroupPanel token={token} />
    </Modal>
  )
}

import { Tooltip as AntdTooltip } from 'antd'
import * as React from 'react'

export const Tooltip = React.forwardRef(function Tooltip(props, ref) {
  const {
    showArrow = true,
    children,
    disabled,
    content,
    portalled = true,
    ...rest
  } = props

  if (disabled) return children

  return (
    <AntdTooltip
      arrow={showArrow}
      title={content}
      destroyTooltipOnHide
      {...rest}
      getPopupContainer={portalled ? undefined : (triggerNode) => triggerNode?.parentElement ?? document.body}
    >
      <span ref={ref} style={{ display: 'inline-flex' }}>
        {children}
      </span>
    </AntdTooltip>
  )
})

/**
 * 故事模式 · Client 端。
 *
 * 输入框上方（conversation.input.dock）：
 * - 右侧是「三条走向」开关：平时只有开关，鼠标移入才浮出「走向开关」四个字；
 * - 开关左侧是设置控件（齿轮），点击展开「记忆管理」底部面板；
 * - 齿轮左侧是 Test 按钮：随时触发上下文提纯（不需要超过 80%）；
 * - 上下文占用 ≥ 80% 且一轮结束（agent 空闲）时自动弹「上下文提纯」窗口：
 *   文本框里是模型整理好的角色/箱庭状态，可改写；点右下角「确认」写入记忆文件（上下文需自行重置）。
 *
 * 所有写操作都通过 ctx.remote.commands.execute 调 Host 命令（/choices、/memory、/purify、/purify-apply）。
 */
window.__ModuleLoader__.load({
  id: 'dsh-story-mode',
  factory: (require) => {
    const React = require('react')
    const h = React.createElement

    const css = {
      // 与输入框卡片相同的宽度与居中方式：
      // 卡片 = 100% - 2 * side-clearance，且不超过 card-max-width。
      root: {
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
        boxSizing: 'border-box',
        width: 'calc(100% - 2 * var(--dsh-composer-side-clearance, 16px))',
        maxWidth: 'var(--dsh-composer-card-max-width, 100%)',
        margin: '0 auto',
        padding: '2px 0 0',
        minWidth: 0,
      },
      row: {
        display: 'flex',
        justifyContent: 'flex-end',
        alignItems: 'center',
        gap: '10px',
        minWidth: 0,
      },
      cluster: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: '8px',
        minWidth: 0,
      },
      label: {
        fontSize: '12px',
        lineHeight: '16px',
        whiteSpace: 'nowrap',
        color: 'var(--dsw-alias-label-secondary)',
        userSelect: 'none',
      },
      errorLabel: {
        fontSize: '12px',
        lineHeight: '16px',
        whiteSpace: 'nowrap',
        color: 'var(--dsw-alias-state-error-primary)',
        maxWidth: '240px',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
      },
      gear: {
        flex: 'none',
        display: 'grid',
        placeItems: 'center',
        width: '24px',
        height: '24px',
        padding: 0,
        border: 'none',
        borderRadius: '6px',
        background: 'transparent',
        color: 'var(--dsw-alias-label-secondary)',
        cursor: 'pointer',
      },
      gearOn: {
        flex: 'none',
        display: 'grid',
        placeItems: 'center',
        width: '24px',
        height: '24px',
        padding: 0,
        border: 'none',
        borderRadius: '6px',
        background: 'var(--dsw-alias-bg-layer-2)',
        color: 'var(--dsw-alias-label-primary)',
        cursor: 'pointer',
      },
      testBtn: {
        flex: 'none',
        height: '22px',
        padding: '0 8px',
        border: '0.5px solid var(--dsw-alias-border-l2)',
        borderRadius: '6px',
        background: 'transparent',
        color: 'var(--dsw-alias-label-secondary)',
        fontSize: '11px',
        lineHeight: '20px',
        cursor: 'pointer',
      },
      testBtnDisabled: {
        flex: 'none',
        height: '22px',
        padding: '0 8px',
        border: '0.5px solid var(--dsw-alias-border-l2)',
        borderRadius: '6px',
        background: 'transparent',
        color: 'var(--dsw-alias-label-secondary)',
        fontSize: '11px',
        lineHeight: '20px',
        cursor: 'default',
        opacity: 0.5,
      },
      track: {
        flex: 'none',
        position: 'relative',
        width: '34px',
        height: '20px',
        padding: 0,
        border: 'none',
        borderRadius: '10px',
        cursor: 'pointer',
        transition: 'background-color 120ms ease',
        background: 'transparent',
      },
      knob: {
        position: 'absolute',
        top: '2px',
        left: '2px',
        width: '16px',
        height: '16px',
        borderRadius: '8px',
        background: 'var(--dsw-alias-bg-base)',
        boxShadow: '0 1px 2px rgba(0, 0, 0, 0.25)',
        transition: 'transform 120ms ease',
      },
      panel: {
        boxSizing: 'border-box',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        padding: '12px 12px 10px',
        border: '0.5px solid var(--dsw-alias-border-l1)',
        borderRadius: '10px',
        background: 'var(--dsw-alias-bg-layer-1)',
      },
      panelTitle: {
        fontSize: '12px',
        lineHeight: '16px',
        fontWeight: 500,
        color: 'var(--dsw-alias-label-primary)',
      },
      field: {
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
        minWidth: 0,
      },
      fieldLabel: {
        fontSize: '11px',
        lineHeight: '15px',
        color: 'var(--dsw-alias-label-secondary)',
      },
      input: {
        boxSizing: 'border-box',
        width: '100%',
        height: '28px',
        padding: '0 8px',
        fontSize: '12px',
        color: 'var(--dsw-alias-label-primary)',
        background: 'var(--dsw-alias-bg-base)',
        border: '0.5px solid var(--dsw-alias-border-l2)',
        borderRadius: '6px',
        outline: 'none',
      },
      actions: {
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        minWidth: 0,
      },
      primary: {
        flex: 'none',
        height: '28px',
        padding: '0 12px',
        border: 'none',
        borderRadius: '6px',
        background: 'var(--dsw-alias-brand-primary)',
        color: '#fff',
        fontSize: '12px',
        lineHeight: '28px',
        cursor: 'pointer',
      },
      primaryDisabled: {
        flex: 'none',
        height: '28px',
        padding: '0 12px',
        border: 'none',
        borderRadius: '6px',
        background: 'var(--dsw-alias-brand-primary)',
        color: '#fff',
        fontSize: '12px',
        lineHeight: '28px',
        cursor: 'default',
        opacity: 0.5,
      },
      secondary: {
        flex: 'none',
        height: '28px',
        padding: '0 12px',
        border: '0.5px solid var(--dsw-alias-border-l2)',
        borderRadius: '6px',
        background: 'transparent',
        color: 'var(--dsw-alias-label-secondary)',
        fontSize: '12px',
        lineHeight: '28px',
        cursor: 'pointer',
      },
      status: {
        minWidth: 0,
        fontSize: '11px',
        lineHeight: '15px',
        color: 'var(--dsw-alias-label-secondary)',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      },
      statusError: {
        minWidth: 0,
        fontSize: '11px',
        lineHeight: '15px',
        color: 'var(--dsw-alias-state-error-primary)',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      },
      notice: {
        minWidth: 0,
        maxWidth: '320px',
        fontSize: '11px',
        lineHeight: '15px',
        color: 'var(--dsw-alias-state-success-primary)',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      },
      noticeError: {
        minWidth: 0,
        maxWidth: '320px',
        fontSize: '11px',
        lineHeight: '15px',
        color: 'var(--dsw-alias-state-error-primary)',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      },
      overlay: {
        position: 'fixed',
        inset: 0,
        zIndex: 1200,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0, 0, 0, 0.45)',
        padding: '24px',
      },
      dialog: {
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        width: 'min(760px, 100%)',
        maxHeight: 'calc(100vh - 96px)',
        padding: '16px',
        borderRadius: '12px',
        border: '0.5px solid var(--dsw-alias-border-l1)',
        background: 'var(--dsw-alias-bg-overlay)',
        boxShadow: '0 12px 40px rgba(0, 0, 0, 0.28)',
      },
      dialogTitle: {
        fontSize: '14px',
        lineHeight: '20px',
        fontWeight: 600,
        color: 'var(--dsw-alias-label-primary)',
      },
      dialogWarning: {
        fontSize: '12px',
        lineHeight: '18px',
        color: 'var(--dsw-alias-state-warn-primary)',
      },
      textarea: {
        boxSizing: 'border-box',
        width: '100%',
        minHeight: '320px',
        flex: 1,
        resize: 'vertical',
        padding: '10px',
        fontSize: '12px',
        lineHeight: '20px',
        color: 'var(--dsw-alias-label-primary)',
        background: 'var(--dsw-alias-bg-base)',
        border: '0.5px solid var(--dsw-alias-border-l2)',
        borderRadius: '8px',
        outline: 'none',
        fontFamily: 'inherit',
      },
      dialogPending: {
        boxSizing: 'border-box',
        width: '100%',
        minHeight: '320px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '12px',
        color: 'var(--dsw-alias-label-secondary)',
        background: 'var(--dsw-alias-bg-base)',
        border: '0.5px solid var(--dsw-alias-border-l1)',
        borderRadius: '8px',
      },
      dialogError: {
        fontSize: '12px',
        lineHeight: '18px',
        color: 'var(--dsw-alias-state-error-primary)',
        maxHeight: '60px',
        overflow: 'auto',
      },
      dialogFooter: {
        display: 'flex',
        justifyContent: 'flex-end',
        alignItems: 'center',
        gap: '8px',
      },
    }

    const trackOn = { ...css.track, background: 'var(--dsw-alias-brand-primary)' }
    const trackOff = { ...css.track, background: 'var(--dsw-alias-border-l2)' }
    const knobOn = { ...css.knob, transform: 'translateX(14px)' }
    const knobOff = css.knob

    /** 齿轮图标（纯 SVG，不依赖 UI 组件包）。 */
    const gearIcon = h(
      'svg',
      {
        width: 14,
        height: 14,
        viewBox: '0 0 16 16',
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: 1.3,
        strokeLinecap: 'round',
        'aria-hidden': true,
      },
      [
        h('circle', { key: 'c', cx: 8, cy: 8, r: 3.2 }),
        h('path', {
          key: 'p',
          d: 'M8 1.2v2.2M8 12.6v2.2M1.2 8h2.2M12.6 8h2.2M3.2 3.2l1.6 1.6M11.2 11.2l1.6 1.6M12.8 3.2l-1.6 1.6M4.8 11.2l-1.6 1.6',
        }),
      ],
    )

    /** 「文件夹 + 加号」图标：初始化工作区。 */
    const folderPlusIcon = h(
      'svg',
      {
        width: 15,
        height: 15,
        viewBox: '0 0 16 16',
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: 1.3,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
        'aria-hidden': true,
      },
      [
        h('path', { key: 'f', d: 'M1.8 4.3a1 1 0 0 1 1-1h3l1.3 1.6h5.1a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1H2.8a1 1 0 0 1-1-1z' }),
        h('path', { key: 'p', d: 'M8 7.3v3.4M6.3 9h3.4' }),
      ],
    )

    /** 一行「标签 + 输入框」。 */
    function field(key, label, value, placeholder, onChange) {
      return h('label', { key, style: css.field }, [
        h('span', { key: 'l', style: css.fieldLabel }, label),
        h('input', {
          key: 'i',
          type: 'text',
          value,
          placeholder,
          spellCheck: false,
          onChange: (event) => onChange(event.target.value),
          style: css.input,
        }),
      ])
    }

    /**
     * 输入框上方的控件区：Test + 齿轮 + 三条走向开关 + 记忆面板 + 提纯窗口。
     * @param props 槽位标准 props，外加 setChoices / saveMemory / purify / applyPurify
     */
    function StoryControls(props) {
      const { useProjection, useSession, sessionId, setChoices, saveMemory, purify, applyPurify, scaffold, memoryDefaults } = props
      const preset = useProjection('agentPreset')
      const choices = useProjection('storyChoices')
      const memory = useProjection('storyMemory')
      const pressure = useProjection('contextPressure')
      const running = typeof useSession === 'function' ? useSession((state) => state.running === true) : false

      const [busy, setBusy] = React.useState(false)
      const [error, setError] = React.useState(null)
      const [hovered, setHovered] = React.useState(false)
      const [open, setOpen] = React.useState(false)
      const [character, setCharacter] = React.useState('')
      const [world, setWorld] = React.useState('')
      const [saving, setSaving] = React.useState(false)
      const [panelStatus, setPanelStatus] = React.useState(null)
      const [dialog, setDialog] = React.useState(null)
      const [notice, setNotice] = React.useState(null)
      const [initializing, setInitializing] = React.useState(false)
      const autoKeyRef = React.useRef(null)

      const active = choices !== undefined && choices !== null && choices.active === true
      const locked = busy || typeof sessionId !== 'string' || sessionId === ''
      // agentPreset 投影通常直接给出预设 id；兼容对象形态。
      const presetId = typeof preset === 'string' ? preset : (preset && (preset.id ?? preset.presetId)) || undefined

      const usedTokens = pressure?.projectedTokens ?? pressure?.pressureTokens
      const percent =
        usedTokens !== undefined && pressure?.contextWindow ? Math.min(100, Math.round((usedTokens / pressure.contextWindow) * 100)) : null

      const toggle = () => {
        if (locked) return
        setBusy(true)
        setError(null)
        Promise.resolve(setChoices(sessionId, !active)).then(
          (failure) => {
            setBusy(false)
            if (failure) setError(failure)
          },
          (reason) => {
            setBusy(false)
            setError(reason instanceof Error ? reason.message : String(reason))
          },
        )
      }

      const openPanel = () => {
        if (open) {
          setOpen(false)
          return
        }
        const currentCharacter = memory !== undefined && memory !== null && typeof memory.character === 'string' ? memory.character : ''
        const currentWorld = memory !== undefined && memory !== null && typeof memory.world === 'string' ? memory.world : ''
        setCharacter(currentCharacter)
        setWorld(currentWorld)
        setPanelStatus(null)
        setOpen(true)

        // 还没配置的一侧预填默认目录（工作区下的 记忆/角色、记忆/箱庭）。
        if (typeof sessionId !== 'string' || sessionId === '') return
        if (currentCharacter !== '' && currentWorld !== '') return
        Promise.resolve(memoryDefaults(sessionId)).then(
          (outcome) => {
            if (outcome === undefined || outcome === null || outcome.error !== undefined || typeof outcome.text !== 'string') return
            let parsed
            try {
              parsed = JSON.parse(outcome.text)
            } catch {
              return
            }
            if (parsed === null || typeof parsed !== 'object') return
            if (typeof parsed.character === 'string') {
              setCharacter((current) => (current === '' ? parsed.character : current))
            }
            if (typeof parsed.world === 'string') {
              setWorld((current) => (current === '' ? parsed.world : current))
            }
          },
          () => {},
        )
      }

      const confirm = () => {
        if (saving || typeof sessionId !== 'string' || sessionId === '') return
        setSaving(true)
        setPanelStatus(null)
        Promise.resolve(saveMemory(sessionId, { character: character.trim(), world: world.trim() })).then(
          (outcome) => {
            setSaving(false)
            setPanelStatus(
              outcome !== undefined && outcome.error !== undefined
                ? { kind: 'error', text: outcome.error }
                : { kind: 'ok', text: (outcome !== undefined && outcome.text) || '已保存' },
            )
          },
          (reason) => {
            setSaving(false)
            setPanelStatus({ kind: 'error', text: reason instanceof Error ? reason.message : String(reason) })
          },
        )
      }

      /** 打开窗口并请求提纯。 */
      const startPurify = (warning) => {
        if (typeof sessionId !== 'string' || sessionId === '') return
        setDialog({ text: '', warning, pending: true, applying: false, error: null })
        Promise.resolve(purify(sessionId)).then(
          (outcome) => {
            setDialog((current) =>
              current === null
                ? current
                : outcome !== undefined && outcome.error !== undefined
                  ? { ...current, pending: false, error: outcome.error }
                  : { ...current, pending: false, text: (outcome !== undefined && outcome.text) || '' },
            )
          },
          (reason) => {
            setDialog((current) =>
              current === null ? current : { ...current, pending: false, error: reason instanceof Error ? reason.message : String(reason) },
            )
          },
        )
      }

      /** 确认：把（可能改过的）文本写入记忆文件（上下文由用户自行重置）。 */
      const confirmPurify = () => {
        if (dialog === null || dialog.applying || dialog.pending) return
        const text = dialog.text
        if (text.trim() === '') return
        setDialog((current) => (current === null ? current : { ...current, applying: true, error: null }))
        Promise.resolve(applyPurify(sessionId, text)).then(
          (outcome) => {
            if (outcome !== undefined && outcome.error !== undefined) {
              setDialog((current) => (current === null ? current : { ...current, applying: false, error: outcome.error }))
              return
            }
            setDialog(null)
            autoKeyRef.current = null
          },
          (reason) => {
            setDialog((current) =>
              current === null
                ? current
                : { ...current, applying: false, error: reason instanceof Error ? reason.message : String(reason) },
            )
          },
        )
      }

      /** 初始化当前工作区的目录与初始文件。 */
      const initWorkspace = () => {
        if (initializing || typeof sessionId !== 'string' || sessionId === '') return
        setInitializing(true)
        setNotice(null)
        Promise.resolve(scaffold(sessionId)).then(
          (outcome) => {
            setInitializing(false)
            if (outcome !== undefined && outcome.error !== undefined) {
              setNotice({ kind: 'error', text: outcome.error })
              return
            }
            setNotice({ kind: 'ok', text: (outcome !== undefined && outcome.text) || '已初始化' })
          },
          (reason) => {
            setInitializing(false)
            setNotice({ kind: 'error', text: reason instanceof Error ? reason.message : String(reason) })
          },
        )
      }

      // 提示 8 秒后自动消失。
      React.useEffect(() => {
        if (notice === null) return undefined
        const timer = setTimeout(() => setNotice(null), 8000)
        return () => clearTimeout(timer)
      }, [notice])

      // 一轮结束（空闲）且上下文 ≥ 80% 时自动弹窗；同一个占用值只触发一次。
      React.useEffect(() => {
        if (presetId !== 'story') return
        if (running) return
        if (dialog !== null) return
        if (percent === null || percent < 80) return
        const key = `${percent}:${usedTokens}`
        if (autoKeyRef.current === key) return
        autoKeyRef.current = key
        startPurify(`上下文已用 ${percent}%（超过 80%）。点「确认」把整理好的状态写入记忆文件；清空上下文请自行重置会话。`)
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, [presetId, running, dialog, percent, usedTokens])

      // 只属于故事模式；其他预设的会话里不渲染。
      if (presetId !== 'story') return null

      const panel = !open
        ? null
        : h('div', { key: 'panel', style: css.panel }, [
            h('div', { key: 'title', style: css.panelTitle }, '记忆管理'),
            field('character', '角色记忆存储位置', character, '例如 D:\\故事\\角色（读取目录内全部 .md）', setCharacter),
            field('world', '箱庭记忆存储位置', world, '例如 D:\\故事\\箱庭（读取目录内全部 .md）', setWorld),
            h('div', { key: 'actions', style: css.actions }, [
              h(
                'button',
                {
                  key: 'confirm',
                  type: 'button',
                  disabled: saving,
                  onClick: confirm,
                  style: saving ? css.primaryDisabled : css.primary,
                },
                '确认并刷新',
              ),
              panelStatus === null
                ? null
                : h(
                    'span',
                    {
                      key: 'status',
                      style: panelStatus.kind === 'error' ? css.statusError : css.status,
                      title: panelStatus.text,
                    },
                    panelStatus.text,
                  ),
            ]),
          ])

      const dialogNode =
        dialog === null
          ? null
          : h('div', { key: 'overlay', style: css.overlay }, h('div', { style: css.dialog }, [
              h('div', { key: 'title', style: css.dialogTitle }, '上下文提纯'),
              dialog.warning === '' || dialog.warning == null
                ? null
                : h('div', { key: 'warning', style: css.dialogWarning }, dialog.warning),
              dialog.pending
                ? h('div', { key: 'pending', style: css.dialogPending }, '正在读取上下文并整理角色 / 箱庭状态，通常需要几十秒…')
                : h('textarea', {
                    key: 'text',
                    value: dialog.text,
                    spellCheck: false,
                    onChange: (event) => {
                      const value = event.target.value
                      setDialog((current) => (current === null ? current : { ...current, text: value }))
                    },
                    style: css.textarea,
                  }),
              dialog.error === null || dialog.error === undefined
                ? null
                : h('div', { key: 'error', style: css.dialogError }, dialog.error),
              h('div', { key: 'footer', style: css.dialogFooter }, [
                h(
                  'button',
                  {
                    key: 'cancel',
                    type: 'button',
                    onClick: () => setDialog(null),
                    disabled: dialog.applying,
                    style: css.secondary,
                  },
                  '取消',
                ),
                h(
                  'button',
                  {
                    key: 'confirm',
                    type: 'button',
                    onClick: confirmPurify,
                    disabled: dialog.applying || dialog.pending || dialog.text.trim() === '',
                    style: dialog.applying || dialog.pending || dialog.text.trim() === '' ? css.primaryDisabled : css.primary,
                  },
                  dialog.applying ? '写入中…' : '确认',
                ),
              ]),
            ]))

      // 平时只有开关；鼠标进入控件范围才浮出文字，出错时改为常驻显示错误。
      const showText = hovered || error !== null

      return h('div', { className: 'dsh-story-choices', style: css.root }, [
        dialogNode,
        panel,
        h('div', { key: 'row', style: css.row }, [
          h(
            'button',
            {
              key: 'scaffold',
              type: 'button',
              title: '初始化当前工作区：settings/front.txt、settings/end.txt 与记忆目录',
              'aria-label': '初始化工作区',
              disabled: initializing,
              onClick: initWorkspace,
              style: initializing ? { ...css.gear, opacity: 0.5, cursor: 'default' } : css.gear,
            },
            folderPlusIcon,
          ),
          h(
            'button',
            {
              key: 'test',
              type: 'button',
              title: '立即提纯上下文（测试用，不需要超过 80%）',
              disabled: dialog !== null,
              onClick: () => startPurify(`测试模式：手动触发提纯${percent === null ? '' : `（当前 ${percent}%）`}。`),
              style: dialog !== null ? css.testBtnDisabled : css.testBtn,
            },
            'Test',
          ),
          h(
            'button',
            {
              key: 'gear',
              type: 'button',
              'aria-label': '记忆管理',
              'aria-expanded': open,
              onClick: openPanel,
              style: open ? css.gearOn : css.gear,
            },
            gearIcon,
          ),
          notice === null
            ? null
            : h('span', { key: 'notice', style: notice.kind === 'error' ? css.noticeError : css.notice, title: notice.text }, notice.text),
          h(
            'div',
            {
              key: 'cluster',
              style: css.cluster,
              onMouseEnter: () => setHovered(true),
              onMouseLeave: () => setHovered(false),
            },
            [
              showText
                ? h(
                    'span',
                    {
                      key: 'label',
                      style: error === null ? css.label : css.errorLabel,
                      title: error === null ? undefined : error,
                    },
                    error === null ? '走向开关' : `切换失败：${error}`,
                  )
                : null,
              h(
                'button',
                {
                  key: 'switch',
                  type: 'button',
                  role: 'switch',
                  'aria-checked': active,
                  'aria-label': '走向开关',
                  disabled: busy,
                  onClick: toggle,
                  style: active ? trackOn : trackOff,
                },
                h('span', { key: 'knob', style: active ? knobOn : knobOff }),
              ),
            ],
          ),
        ]),
      ])
    }

    /** 统一的「执行命令并解包结果」：成功返回 { text }，失败返回 { error }。 */
    async function runCommand(ctx, sessionId, line) {
      const remote = ctx.get('remote') ?? ctx.remote
      const commands = remote?.commands
      if (commands === undefined || commands === null || typeof commands.execute !== 'function') {
        return { error: '宿主没有提供命令通道' }
      }
      try {
        const result = await commands.execute(sessionId, line, [])
        if (result === undefined || result === null) return { error: '命令没有返回结果' }
        if (result.ok !== true) {
          const detail = result.error?.message ?? result.error?.code
          return { error: detail === undefined ? '命令执行失败' : `${detail}` }
        }
        if (result.value === undefined) return { error: `当前会话没有该命令：${line.split(' ')[0]}` }
        const outcome = result.value.result
        if (outcome === undefined) return { error: '命令没有返回结果' }
        if (outcome.kind === 'error') return { error: outcome.text }
        return { text: outcome.text }
      } catch (reason) {
        return { error: reason instanceof Error ? reason.message : String(reason) }
      }
    }

    return {
      inject: ['slots', 'remote', 'remote.commands'],
      apply(ctx) {
        ctx.slots.inject('conversation.input.dock', () =>
          ctx.slots.register(
            {
              name: 'conversation.input.dock',
              id: 'story-choices',
              order: 15,
            },
            (props) =>
              h(StoryControls, {
                ...props,
                setChoices: async (sessionId, enabled) => {
                  const outcome = await runCommand(ctx, sessionId, enabled ? '/choices on' : '/choices off')
                  return outcome.error ?? null
                },
                saveMemory: (sessionId, payload) => runCommand(ctx, sessionId, `/memory ${JSON.stringify(payload)}`),
                purify: (sessionId) => runCommand(ctx, sessionId, '/purify'),
                applyPurify: (sessionId, text) => runCommand(ctx, sessionId, `/purify-apply ${JSON.stringify({ text })}`),
                scaffold: (sessionId) => runCommand(ctx, sessionId, '/init-workspace'),
                memoryDefaults: (sessionId) => runCommand(ctx, sessionId, '/memory-defaults'),
              }),
          ),
        )
      },
    }
  },
})

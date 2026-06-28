/**
 * @typedef {object} MeetingActionItem
 * @property {string} id
 * @property {string} title
 * @property {string} owner
 * @property {string} dueDate
 * @property {"待处理" | "进行中" | "已完成"} status
 */

/**
 * @typedef {object} MeetingDecision
 * @property {string} id
 * @property {string} text
 */

/**
 * @typedef {object} TranscriptSegment
 * @property {string} id
 * @property {string} time
 * @property {string} speaker
 * @property {string} text
 */

/**
 * @typedef {object} MeetingVersion
 * @property {string} version
 * @property {string} publishedBy
 * @property {string} publishedAt
 * @property {string} summary
 */

/**
 * @typedef {object} RagCitation
 * @property {string} id
 * @property {string} noteId
 * @property {string} noteTitle
 * @property {string} segmentId
 * @property {string} snippet
 */

/**
 * @typedef {object} MeetingNote
 * @property {string} id
 * @property {string} title
 * @property {string} date
 * @property {string} timeRange
 * @property {string} project
 * @property {string[]} tags
 * @property {string[]} participants
 * @property {string} recorder
 * @property {string} source
 * @property {string} version
 * @property {"已发布" | "有草稿" | "待校订"} status
 * @property {string} summary
 * @property {MeetingDecision[]} decisions
 * @property {MeetingActionItem[]} actionItems
 * @property {TranscriptSegment[]} transcript
 * @property {MeetingVersion[]} versions
 * @property {RagCitation[]} citations
 */

/**
 * @typedef {object} MeetingNoteFilters
 * @property {string} [keyword]
 * @property {string} [participant]
 * @property {string} [startDate]
 * @property {string} [endDate]
 * @property {string} [project]
 * @property {string} [tag]
 */

/** @type {MeetingNote[]} */
export const meetingNotes = [
  {
    id: "meeting-payment-review",
    title: "支付链路故障复盘会",
    date: "2026-06-18",
    timeRange: "14:00-15:10",
    project: "支付平台",
    tags: ["故障复盘", "支付", "行动项"],
    participants: ["李雷", "韩梅梅", "王敏"],
    recorder: "ops.reader",
    source: "本机录制程序 · payment-review.wav",
    version: "v3",
    status: "有草稿",
    summary:
      "会议确认支付回调延迟与队列堆积、发布窗口配置变更相关，需要补充告警阈值和发布前检查项。",
    decisions: [
      {
        id: "decision-payment-queue",
        text: "支付回调队列积压超过 5 分钟时进入一级排查流程。",
      },
      {
        id: "decision-payment-release",
        text: "发布检查模板增加回调消费者并发数核对项。",
      },
    ],
    actionItems: [
      {
        id: "action-payment-alert",
        title: "补充支付回调队列积压告警",
        owner: "李雷",
        dueDate: "2026-06-25",
        status: "进行中",
      },
      {
        id: "action-payment-runbook",
        title: "更新支付链路故障 Runbook",
        owner: "韩梅梅",
        dueDate: "2026-06-28",
        status: "待处理",
      },
    ],
    transcript: [
      {
        id: "seg-payment-1",
        time: "00:03:12",
        speaker: "李雷",
        text: "本次支付失败主要集中在回调阶段，队列积压从 14:12 开始持续上升。",
      },
      {
        id: "seg-payment-2",
        time: "00:18:40",
        speaker: "韩梅梅",
        text: "发布窗口里消费者并发数被调低，但发布检查清单没有覆盖这个配置。",
      },
      {
        id: "seg-payment-3",
        time: "00:44:05",
        speaker: "王敏",
        text: "后续需要把队列积压和支付成功率放到同一个排查面板里。",
      },
    ],
    versions: [
      {
        version: "v1",
        publishedBy: "meeting-recorder",
        publishedAt: "2026-06-18 15:24",
        summary: "自动总结版本。",
      },
      {
        version: "v3",
        publishedBy: "李雷",
        publishedAt: "2026-06-19 09:12",
        summary: "补充行动项负责人和发布检查决策。",
      },
    ],
    citations: [
      {
        id: "citation-payment-queue",
        noteId: "meeting-payment-review",
        noteTitle: "支付链路故障复盘会",
        segmentId: "seg-payment-1",
        snippet: "队列积压从 14:12 开始持续上升。",
      },
      {
        id: "citation-payment-release",
        noteId: "meeting-payment-review",
        noteTitle: "支付链路故障复盘会",
        segmentId: "seg-payment-2",
        snippet: "发布检查清单没有覆盖消费者并发数配置。",
      },
    ],
  },
  {
    id: "meeting-release-review",
    title: "6 月发布评审会",
    date: "2026-06-12",
    timeRange: "10:30-11:20",
    project: "发布治理",
    tags: ["需求评审", "发布", "检查清单"],
    participants: ["赵强", "李雷", "陈晨"],
    recorder: "ops.reader",
    source: "本机录制程序 · release-review.wav",
    version: "v2",
    status: "已发布",
    summary:
      "会议确认 6 月发布窗口、回滚负责人和灰度观察指标，要求所有高风险服务补齐发布前检查记录。",
    decisions: [
      {
        id: "decision-release-window",
        text: "核心链路服务统一进入 22:00 后发布窗口。",
      },
    ],
    actionItems: [
      {
        id: "action-release-checklist",
        title: "整理发布前检查清单",
        owner: "陈晨",
        dueDate: "2026-06-16",
        status: "已完成",
      },
    ],
    transcript: [
      {
        id: "seg-release-1",
        time: "00:06:20",
        speaker: "赵强",
        text: "本次发布要把回滚负责人和灰度观察指标写进纪要。",
      },
      {
        id: "seg-release-2",
        time: "00:28:10",
        speaker: "陈晨",
        text: "检查清单会增加数据库迁移和队列消费者配置项。",
      },
    ],
    versions: [
      {
        version: "v2",
        publishedBy: "陈晨",
        publishedAt: "2026-06-12 13:40",
        summary: "确认发布窗口和回滚负责人。",
      },
    ],
    citations: [
      {
        id: "citation-release-owner",
        noteId: "meeting-release-review",
        noteTitle: "6 月发布评审会",
        segmentId: "seg-release-1",
        snippet: "把回滚负责人和灰度观察指标写进纪要。",
      },
    ],
  },
  {
    id: "meeting-daily-ops",
    title: "运维早会同步",
    date: "2026-05-30",
    timeRange: "09:30-09:55",
    project: "平台运维",
    tags: ["日常站会", "巡检"],
    participants: ["孙婷", "周洋"],
    recorder: "ops.reader",
    source: "上传录音 · daily-ops.mp3",
    version: "v1",
    status: "待校订",
    summary: "早会同步夜间告警、巡检结果和当天值班安排。",
    decisions: [
      {
        id: "decision-daily-duty",
        text: "本周值班交接继续保留双人确认。",
      },
    ],
    actionItems: [
      {
        id: "action-daily-noise",
        title: "归并重复告警规则",
        owner: "周洋",
        dueDate: "2026-06-03",
        status: "待处理",
      },
    ],
    transcript: [
      {
        id: "seg-daily-1",
        time: "00:04:18",
        speaker: "孙婷",
        text: "夜间告警没有生产写操作，主要是重复规则触发。",
      },
    ],
    versions: [
      {
        version: "v1",
        publishedBy: "meeting-recorder",
        publishedAt: "2026-05-30 10:12",
        summary: "自动总结版本，等待人工校订。",
      },
    ],
    citations: [
      {
        id: "citation-daily-noise",
        noteId: "meeting-daily-ops",
        noteTitle: "运维早会同步",
        segmentId: "seg-daily-1",
        snippet: "主要是重复规则触发。",
      },
    ],
  },
];

/**
 * @param {string | undefined} value
 */
function normalize(value) {
  return (value ?? "").trim().toLowerCase();
}

/**
 * @param {MeetingNote} note
 */
function searchableText(note) {
  return [
    note.title,
    note.summary,
    note.project,
    note.tags.join(" "),
    note.participants.join(" "),
    ...note.decisions.map((decision) => decision.text),
    ...note.actionItems.map((item) => `${item.title} ${item.owner}`),
    ...note.transcript.map((segment) => `${segment.speaker} ${segment.text}`),
  ]
    .join(" ")
    .toLowerCase();
}

/**
 * @param {MeetingNote} note
 * @param {MeetingNoteFilters} filters
 */
function matchesFilters(note, filters) {
  const keyword = normalize(filters.keyword);
  const participant = normalize(filters.participant);
  const project = normalize(filters.project);
  const tag = normalize(filters.tag);

  if (keyword && !searchableText(note).includes(keyword)) {
    return false;
  }
  if (
    participant &&
    !note.participants.some((currentParticipant) =>
      currentParticipant.toLowerCase().includes(participant),
    )
  ) {
    return false;
  }
  if (filters.startDate && note.date < filters.startDate) {
    return false;
  }
  if (filters.endDate && note.date > filters.endDate) {
    return false;
  }
  if (project && note.project.toLowerCase() !== project) {
    return false;
  }
  if (tag && !note.tags.some((currentTag) => currentTag.toLowerCase() === tag)) {
    return false;
  }

  return true;
}

/**
 * @param {MeetingNoteFilters} [filters]
 * @returns {MeetingNote[]}
 */
export function filterMeetingNotes(filters = {}) {
  return meetingNotes.filter((note) => matchesFilters(note, filters));
}

/**
 * @param {string | undefined} noteId
 * @returns {MeetingNote | null}
 */
export function findMeetingNoteById(noteId) {
  return meetingNotes.find((note) => note.id === noteId) ?? null;
}

export const recordingProgramSettings = {
  operator: "ops.reader",
  clientDevice: "当前操作员 PC",
  pythonPath: "C:\\Python311\\python.exe",
  scriptPath: "D:\\meeting-recorder\\record.py",
  workingDirectory: "D:\\meeting-recorder",
  outputDirectory: "D:\\meeting-recorder\\output",
  version: "recorder-0.9.4",
  status: "已保存，待本机桥接程序校验",
};

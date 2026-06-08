// ====================================================================
// 유틸리티
// ====================================================================

function formatDateKorean(date) {
  if (!date) return '';
  var d = (date instanceof Date) ? date : new Date(date);
  return d.getFullYear() + '년 ' + (d.getMonth() + 1) + '월 ' + d.getDate() + '일';
}

function dateDiffDays(start, end) {
  var s = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  var e = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  return Math.round((e - s) / 86400000) + 1;
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 6);
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeHtmlNl(str) {
  return escapeHtml(str).replace(/\n/g, '<br>');
}

// ====================================================================
// Firestore 데이터 함수 (localStorage 대체)
// ====================================================================

async function getReports() {
  try {
    var snapshot = await db.collection('reports').orderBy('createdAt', 'desc').get();
    return snapshot.docs.map(function(doc) { return doc.data(); });
  } catch (e) {
    console.error('신고서 불러오기 오류:', e);
    return [];
  }
}

async function saveReportToStorage(report) {
  await db.collection('reports').doc(report.id).set(report);
}

async function getReportById(id) {
  var doc = await db.collection('reports').doc(id).get();
  return doc.exists ? doc.data() : null;
}

async function deleteReportById(id) {
  await db.collection('reports').doc(id).delete();
}

// ====================================================================
// 달력
// ====================================================================

var calState = {
  isOpen: false,
  mode: 'single',
  targetInputId: null,
  onSelect: null,
  currentMonth: new Date(),
  rangeStep: 'start',
  rangeStart: null,
  rangeEnd: null
};

function openCalendarFor(inputId, mode, onSelectCallback) {
  calState.isOpen = true;
  calState.mode = mode || 'single';
  calState.targetInputId = inputId;
  calState.onSelect = onSelectCallback || null;
  calState.rangeStep = 'start';
  calState.rangeStart = null;
  calState.rangeEnd = null;
  calState.currentMonth = new Date();

  var hint = document.getElementById('cal-range-hint');
  if (mode === 'range') {
    hint.style.display = 'block';
    hint.textContent = '시작일을 선택하세요';
  } else {
    hint.style.display = 'none';
  }

  renderCalendar();
  document.getElementById('calendar-overlay').style.display = 'flex';
}

function closeCalendar(e) {
  document.getElementById('calendar-overlay').style.display = 'none';
  calState.isOpen = false;
}

function changeCalendarMonth(delta) {
  var d = calState.currentMonth;
  calState.currentMonth = new Date(d.getFullYear(), d.getMonth() + delta, 1);
  renderCalendar();
}

function renderCalendar() {
  var d = calState.currentMonth;
  var year = d.getFullYear();
  var month = d.getMonth();
  var monthNames = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'];
  document.getElementById('cal-month-year').textContent = year + '년 ' + monthNames[month];

  var container = document.getElementById('cal-days');
  container.innerHTML = '';

  var firstDay = new Date(year, month, 1).getDay();
  var lastDate = new Date(year, month + 1, 0).getDate();
  var today = new Date();

  for (var i = 0; i < firstDay; i++) {
    var empty = document.createElement('span');
    empty.className = 'cal-day empty';
    container.appendChild(empty);
  }

  for (var day = 1; day <= lastDate; day++) {
    (function(day) {
      var el = document.createElement('span');
      var thisDate = new Date(year, month, day);
      var classes = ['cal-day'];

      if (today.getFullYear() === year && today.getMonth() === month && today.getDate() === day) {
        classes.push('today');
      }

      if (calState.mode === 'range' && calState.rangeStart) {
        var dateStr  = thisDate.toDateString();
        var startStr = calState.rangeStart.toDateString();
        if (calState.rangeEnd) {
          var endStr = calState.rangeEnd.toDateString();
          if (dateStr === startStr) {
            classes.push('range-start');
          } else if (dateStr === endStr) {
            classes.push('range-end');
          } else if (thisDate > calState.rangeStart && thisDate < calState.rangeEnd) {
            classes.push('in-range');
          }
        } else {
          if (dateStr === startStr) classes.push('range-start');
        }
      }

      el.className = classes.join(' ');
      el.textContent = day;
      el.addEventListener('click', function() { handleCalDayClick(thisDate); });
      container.appendChild(el);
    })(day);
  }
}

function handleCalDayClick(date) {
  if (calState.mode === 'single') {
    var formatted = formatDateKorean(date);
    if (calState.targetInputId) {
      document.getElementById(calState.targetInputId).value = formatted;
    }
    if (calState.onSelect) calState.onSelect(date, formatted);
    closeCalendar();

  } else if (calState.mode === 'range') {
    if (calState.rangeStep === 'start') {
      calState.rangeStart = date;
      calState.rangeEnd   = null;
      calState.rangeStep  = 'end';
      document.getElementById('cal-range-hint').textContent = '종료일을 선택하세요';
      renderCalendar();

    } else {
      var start = date < calState.rangeStart ? date : calState.rangeStart;
      var end   = date < calState.rangeStart ? calState.rangeStart : date;
      calState.rangeStart = start;
      calState.rangeEnd   = end;

      var days = dateDiffDays(start, end);
      var display = days === 1
        ? formatDateKorean(start) + ' (1일간)'
        : formatDateKorean(start) + ' ~ ' + formatDateKorean(end) + ' (' + days + '일간)';

      if (calState.targetInputId) {
        document.getElementById(calState.targetInputId).value = display;
      }
      if (calState.onSelect) calState.onSelect(start, end, display);

      renderCalendar();
      setTimeout(closeCalendar, 350);
    }
  }
}

// ====================================================================
// 신고서 작성 폼 (form.html)
// ====================================================================

var formState = {
  type: null,
  absenceSubType: '질병결',
  editId: null,
  absenceStart: null,
  absenceEnd: null
};

var PERIODS = ['조회', '1교시', '2교시', '3교시', '4교시', '5교시', '6교시', '7교시', '종례'];

async function initForm() {
  var numSelect = document.getElementById('number');
  if (numSelect) {
    for (var i = 1; i <= 30; i++) {
      var opt = document.createElement('option');
      opt.value = String(i);
      opt.textContent = i + '번';
      numSelect.appendChild(opt);
    }
  }

  var params = new URLSearchParams(window.location.search);
  var editId = params.get('id');
  if (editId) {
    var report = await getReportById(editId);
    if (report) loadReportIntoForm(report);
  }
}

function selectType(type) {
  formState.type = type;
  formState.absenceSubType = '질병결';
  formState.absenceStart = null;
  formState.absenceEnd   = null;

  document.querySelectorAll('.type-btn').forEach(function(btn) {
    btn.classList.remove('active');
    if (btn.dataset.type === type) btn.classList.add('active');
  });

  document.getElementById('date-section').style.display    = 'block';
  document.getElementById('reason-section').style.display  = 'block';
  document.getElementById('confirm-section').style.display = 'block';
  document.getElementById('form-actions').style.display    = 'flex';

  renderDateSection(type);
}

function getPeriodOptions() {
  return PERIODS.map(function(p) {
    return '<option value="' + p + '">' + p + '</option>';
  }).join('');
}

function renderDateSection(type) {
  var content    = document.getElementById('date-content');
  var periodOpts = getPeriodOptions();

  if (type === '결석') {
    content.innerHTML =
      '<div id="absence-subtype-wrap" class="subtype-group">' +
        '<span class="subtype-label">결석 유형:</span>' +
        '<label class="radio-label selected" id="lbl-jilbyeong">' +
          '<input type="radio" name="absence-sub" value="질병결" checked onchange="setAbsenceSubType(\'질병결\')">' +
          '질병결' +
        '</label>' +
        '<label class="radio-label" id="lbl-injeong">' +
          '<input type="radio" name="absence-sub" value="인정결" onchange="setAbsenceSubType(\'인정결\')">' +
          '인정결' +
        '</label>' +
      '</div>' +
      '<div class="form-group">' +
        '<label>결석 기간 <span class="required">*</span></label>' +
        '<input type="text" id="absence-period" class="date-input date-range-input" readonly ' +
          'placeholder="클릭하여 시작일 선택 → 종료일 선택" ' +
          'onclick="openCalendarFor(\'absence-period\', \'range\', onAbsenceRangeSelect)">' +
        '<p class="input-hint">입력란을 클릭하면 달력이 열립니다. 시작일과 종료일을 차례로 선택하세요.</p>' +
      '</div>';

  } else if (type === '조퇴') {
    content.innerHTML =
      '<div class="form-row two-col">' +
        '<div class="form-group">' +
          '<label>조퇴 날짜 <span class="required">*</span></label>' +
          '<input type="text" id="leave-date" class="date-input" readonly ' +
            'placeholder="달력 클릭 후 선택" ' +
            'onclick="openCalendarFor(\'leave-date\', \'single\', null)">' +
        '</div>' +
        '<div class="form-group">' +
          '<label>조퇴 시작 교시 <span class="required">*</span></label>' +
          '<select id="leave-period"><option value="">교시 선택</option>' + periodOpts + '</select>' +
        '</div>' +
      '</div>';

  } else if (type === '지각') {
    content.innerHTML =
      '<div class="form-row two-col">' +
        '<div class="form-group">' +
          '<label>지각 날짜 <span class="required">*</span></label>' +
          '<input type="text" id="late-date" class="date-input" readonly ' +
            'placeholder="달력 클릭 후 선택" ' +
            'onclick="openCalendarFor(\'late-date\', \'single\', null)">' +
        '</div>' +
        '<div class="form-group">' +
          '<label>지각 마지막 교시 <span class="required">*</span></label>' +
          '<select id="late-period"><option value="">교시 선택</option>' + periodOpts + '</select>' +
        '</div>' +
      '</div>';

  } else if (type === '결과') {
    content.innerHTML =
      '<div class="form-row three-col">' +
        '<div class="form-group">' +
          '<label>날짜 <span class="required">*</span></label>' +
          '<input type="text" id="gyeolgwa-date" class="date-input" readonly ' +
            'placeholder="달력 클릭 후 선택" ' +
            'onclick="openCalendarFor(\'gyeolgwa-date\', \'single\', null)">' +
        '</div>' +
        '<div class="form-group">' +
          '<label>시작 교시 <span class="required">*</span></label>' +
          '<select id="gyeolgwa-start"><option value="">교시 선택</option>' + periodOpts + '</select>' +
        '</div>' +
        '<div class="form-group">' +
          '<label>마지막 교시 <span class="required">*</span></label>' +
          '<select id="gyeolgwa-end"><option value="">교시 선택</option>' + periodOpts + '</select>' +
        '</div>' +
      '</div>';
  }
}

function setAbsenceSubType(subType) {
  formState.absenceSubType = subType;
  var lblJ = document.getElementById('lbl-jilbyeong');
  var lblI = document.getElementById('lbl-injeong');
  if (lblJ) lblJ.classList.toggle('selected', subType === '질병결');
  if (lblI) lblI.classList.toggle('selected', subType === '인정결');
}

function onAbsenceRangeSelect(start, end, display) {
  formState.absenceStart = start;
  formState.absenceEnd   = end;
}

// ====================================================================
// 폼 저장
// ====================================================================

async function saveForm() {
  if (!formState.type) {
    alert('유형을 선택해주세요.');
    return;
  }

  var grade  = document.getElementById('grade').value;
  var cls    = document.getElementById('classNum').value;
  var number = document.getElementById('number').value;
  var name   = document.getElementById('student-name').value.trim();

  if (!grade || !cls || !number || !name) {
    alert('학생 정보를 모두 입력해주세요.');
    return;
  }

  var dateData = {};

  if (formState.type === '결석') {
    var period = document.getElementById('absence-period') ? document.getElementById('absence-period').value : '';
    if (!period || !formState.absenceStart) {
      alert('결석 기간을 선택해주세요.');
      return;
    }
    dateData.absencePeriod    = period;
    dateData.absenceSubType   = formState.absenceSubType || '질병결';
    dateData.absenceStartDate = formState.absenceStart.toISOString();
    dateData.absenceEndDate   = formState.absenceEnd ? formState.absenceEnd.toISOString() : formState.absenceStart.toISOString();

  } else if (formState.type === '조퇴') {
    var leaveDate   = document.getElementById('leave-date')   ? document.getElementById('leave-date').value   : '';
    var leavePeriod = document.getElementById('leave-period') ? document.getElementById('leave-period').value : '';
    if (!leaveDate || !leavePeriod) {
      alert('조퇴 날짜와 교시를 선택해주세요.');
      return;
    }
    dateData.leaveDate   = leaveDate;
    dateData.leavePeriod = leavePeriod;

  } else if (formState.type === '지각') {
    var lateDate   = document.getElementById('late-date')   ? document.getElementById('late-date').value   : '';
    var latePeriod = document.getElementById('late-period') ? document.getElementById('late-period').value : '';
    if (!lateDate || !latePeriod) {
      alert('지각 날짜와 교시를 선택해주세요.');
      return;
    }
    dateData.lateDate   = lateDate;
    dateData.latePeriod = latePeriod;

  } else if (formState.type === '결과') {
    var gyeolgwaDate  = document.getElementById('gyeolgwa-date')  ? document.getElementById('gyeolgwa-date').value  : '';
    var gyeolgwaStart = document.getElementById('gyeolgwa-start') ? document.getElementById('gyeolgwa-start').value : '';
    var gyeolgwaEnd   = document.getElementById('gyeolgwa-end')   ? document.getElementById('gyeolgwa-end').value   : '';
    if (!gyeolgwaDate || !gyeolgwaStart || !gyeolgwaEnd) {
      alert('결과 날짜와 교시를 모두 선택해주세요.');
      return;
    }
    dateData.gyeolgwaDate  = gyeolgwaDate;
    dateData.gyeolgwaStart = gyeolgwaStart;
    dateData.gyeolgwaEnd   = gyeolgwaEnd;
  }

  var reason      = document.getElementById('reason').value.trim();
  var parentNote  = '';
  var confirmDate = document.getElementById('confirm-date').value;

  if (!confirmDate) {
    alert('확인 날짜를 선택해주세요.');
    return;
  }

  var saveBtn = document.querySelector('.form-actions .btn-primary');
  if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = '저장 중...'; }

  try {
    var existing = formState.editId ? await getReportById(formState.editId) : null;
    var report   = Object.assign({
      id:          formState.editId || generateId(),
      createdAt:   existing ? existing.createdAt : new Date().toISOString(),
      updatedAt:   new Date().toISOString(),
      type:        formState.type,
      grade:       grade,
      classNum:    cls,
      number:      number,
      name:        name,
      reason:      reason,
      parentNote:  parentNote,
      confirmDate: confirmDate
    }, dateData);

    await saveReportToStorage(report);
    alert('신고서가 저장되었습니다.');
    window.location.href = 'index.html';
  } catch (e) {
    console.error('저장 오류:', e);
    alert('저장 중 오류가 발생했습니다. 인터넷 연결을 확인해주세요.');
    if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = '저장'; }
  }
}

// ====================================================================
// 폼에 기존 데이터 로드 (수정 모드)
// ====================================================================

function loadReportIntoForm(report) {
  formState.editId = report.id;

  selectType(report.type);

  document.getElementById('grade').value        = report.grade    || '';
  document.getElementById('classNum').value     = report.classNum || '';
  document.getElementById('number').value       = report.number   || '';
  document.getElementById('student-name').value = report.name     || '';

  if (report.type === '결석') {
    var el = document.getElementById('absence-period');
    if (el && report.absencePeriod) el.value = report.absencePeriod;
    if (report.absenceStartDate) formState.absenceStart = new Date(report.absenceStartDate);
    if (report.absenceEndDate)   formState.absenceEnd   = new Date(report.absenceEndDate);
    if (report.absenceSubType) {
      formState.absenceSubType = report.absenceSubType;
      var radio = document.querySelector('input[name="absence-sub"][value="' + report.absenceSubType + '"]');
      if (radio) radio.checked = true;
      setAbsenceSubType(report.absenceSubType);
    }

  } else if (report.type === '조퇴') {
    var ld = document.getElementById('leave-date');
    var lp = document.getElementById('leave-period');
    if (ld && report.leaveDate)   ld.value = report.leaveDate;
    if (lp && report.leavePeriod) lp.value = report.leavePeriod;

  } else if (report.type === '지각') {
    var ltd = document.getElementById('late-date');
    var ltp = document.getElementById('late-period');
    if (ltd && report.lateDate)   ltd.value = report.lateDate;
    if (ltp && report.latePeriod) ltp.value = report.latePeriod;

  } else if (report.type === '결과') {
    var gd = document.getElementById('gyeolgwa-date');
    var gs = document.getElementById('gyeolgwa-start');
    var ge = document.getElementById('gyeolgwa-end');
    if (gd && report.gyeolgwaDate)  gd.value = report.gyeolgwaDate;
    if (gs && report.gyeolgwaStart) gs.value = report.gyeolgwaStart;
    if (ge && report.gyeolgwaEnd)   ge.value = report.gyeolgwaEnd;
  }

  document.getElementById('reason').value       = report.reason      || '';
  document.getElementById('confirm-date').value = report.confirmDate || '';

  document.getElementById('page-title').textContent = '출결 신고서 수정';
}

// ====================================================================
// 폼 데이터 수집 (PDF/인쇄용)
// ====================================================================

function collectFormData() {
  if (!formState.type) {
    alert('유형을 선택해주세요.');
    return null;
  }

  var grade  = document.getElementById('grade').value;
  var cls    = document.getElementById('classNum').value;
  var number = document.getElementById('number').value;
  var name   = document.getElementById('student-name').value.trim();

  var dateText = '';
  var subType  = '';

  if (formState.type === '결석') {
    dateText = (document.getElementById('absence-period') || {}).value || '';
    subType  = formState.absenceSubType || '질병결';
  } else if (formState.type === '조퇴') {
    var d = (document.getElementById('leave-date')   || {}).value || '';
    var p = (document.getElementById('leave-period') || {}).value || '';
    dateText = d + (p ? ' ' + p + '부터 조퇴' : '');
  } else if (formState.type === '지각') {
    var d2 = (document.getElementById('late-date')   || {}).value || '';
    var p2 = (document.getElementById('late-period') || {}).value || '';
    dateText = d2 + (p2 ? ' ' + p2 + '까지 지각' : '');
  } else if (formState.type === '결과') {
    var gd = (document.getElementById('gyeolgwa-date')  || {}).value || '';
    var gs = (document.getElementById('gyeolgwa-start') || {}).value || '';
    var ge = (document.getElementById('gyeolgwa-end')   || {}).value || '';
    dateText = gd + ' ' + buildGyeolgwaText(gs, ge);
  }

  return {
    type:        formState.type,
    absenceSubType: subType,
    grade:       grade,
    classNum:    cls,
    number:      number,
    name:        name,
    dateText:    dateText,
    reason:      (document.getElementById('reason')       || {}).value || '',
    parentNote:  (document.getElementById('parent-note')  || {}).value || '',
    confirmDate: (document.getElementById('confirm-date') || {}).value || ''
  };
}

function buildGyeolgwaText(startPeriod, endPeriod) {
  if (!startPeriod && !endPeriod) return '';
  if (startPeriod === endPeriod) return startPeriod + ' 결과';
  return startPeriod + '부터 ' + endPeriod + '까지 결과';
}

// ====================================================================
// PDF 문서 HTML 생성
// ====================================================================

function buildDocCSS() {
  return [
    '@media print { #preview-actions { display: none !important; } #preview-notice { display: none !important; } body { background: white; padding: 0; } .doc-wrap { box-shadow: none !important; } }',
    '* { box-sizing: border-box; margin: 0; padding: 0; }',
    'body { font-family: "Malgun Gothic","맑은 고딕","Apple SD Gothic Neo",sans-serif; background: #E8EAED; min-height: 100vh; display: flex; flex-direction: column; align-items: center; padding: 20px 16px; }',
    '.doc-wrap { background: white; width: 210mm; max-width: 100%; padding: 19mm 13mm 8mm; box-shadow: 0 6px 30px rgba(0,0,0,0.2); }',
    '.doc-title { text-align: center; font-size: 17pt; font-weight: 900; letter-spacing: 6px; margin-bottom: 3mm; padding-bottom: 2.5mm; border-bottom: 2px solid #222; }',
    '.approval-section { display: flex; justify-content: flex-end; align-items: stretch; margin-bottom: 3mm; }',
    '.ap-vertical { border: 1.5px solid #333; border-right: none; writing-mode: vertical-rl; font-size: 10pt; font-weight: 700; letter-spacing: 4px; padding: 3px 6px; display: flex; align-items: center; justify-content: center; }',
    '.ap-table { border-collapse: collapse; }',
    '.ap-table td { border: 1.5px solid #333; text-align: center; width: 21mm; }',
    '.ap-name-row td { font-size: 7pt; font-weight: 700; height: 7mm; vertical-align: middle; padding: 1px 2px; position: relative; }',
    '.ap-sign-row td { height: 14mm; position: relative; vertical-align: top; padding: 2px 3px; }',
    '.jeongyeol-sign { position: absolute; top: 2px; left: 3px; font-size: 5.5pt; font-weight: 700; color: #333; line-height: 1; }',
    '.info-tbl { width: 100%; border-collapse: collapse; margin-bottom: 2mm; }',
    '.info-tbl th, .info-tbl td { border: 1.5px solid #333; padding: 1.5mm 3mm; font-size: 10pt; vertical-align: middle; }',
    '.info-tbl th { background: #F5F5F5; font-weight: 700; width: 24mm; text-align: center; }',
    '.kind-tbl { width: 100%; border-collapse: collapse; margin-bottom: 2mm; }',
    '.kind-tbl th, .kind-tbl td { border: 1.5px solid #333; padding: 1mm 3mm; font-size: 9pt; vertical-align: middle; }',
    '.kind-header { background: #F5F5F5; font-weight: 700; text-align: center; width: 10mm; letter-spacing: 2px; writing-mode: vertical-rl; }',
    '.kind-item { font-size: 9pt; }',
    '.kind-item-pair { display: flex; gap: 16px; }',
    '.kind-period { font-size: 8.5pt; color: #444; background: #FAFBFF; padding: 0.8mm 3mm; }',
    '.check-mark { font-weight: 900; color: #000; }',
    '.reason-tbl { width: 100%; border-collapse: collapse; margin-bottom: 2mm; }',
    '.reason-tbl th, .reason-tbl td { border: 1.5px solid #333; padding: 1.5mm 3mm; font-size: 10pt; vertical-align: top; }',
    '.reason-tbl th { background: #F5F5F5; font-weight: 700; width: 18mm; text-align: center; vertical-align: middle; }',
    '.reason-content { min-height: 37mm; white-space: pre-wrap; word-break: break-all; line-height: 1.7; }',
    '.notice-box { border: 1px solid #BDBDBD; padding: 1.5mm 3mm; margin-bottom: 2mm; font-size: 8.5pt; line-height: 1.7; color: #555; background: #FAFAFA; }',
    '.notice-box p { margin-bottom: 0; }',
    '.parent-tbl { width: 100%; border-collapse: collapse; margin-bottom: 3mm; }',
    '.parent-tbl th, .parent-tbl td { border: 1.5px solid #333; padding: 0; vertical-align: top; }',
    '.parent-tbl th { background: #F5F5F5; font-weight: 700; width: 18mm; text-align: center; font-size: 9pt; vertical-align: middle; padding: 1.5mm 2mm; }',
    '.parent-content { min-height: 27mm; font-size: 10pt; white-space: pre-wrap; word-break: break-all; line-height: 1.8; padding: 1.5mm 3mm; }',
    '.submit-section { text-align: center; margin-bottom: 3mm; }',
    '.submit-text { font-size: 12pt; font-weight: 700; margin-bottom: 1.5mm; }',
    '.submit-date { font-size: 11pt; font-weight: 700; }',
    '.sign-wrap { display: flex; flex-direction: column; gap: 2mm; margin-bottom: 2.5mm; }',
    '.sign-item { display: flex; align-items: flex-end; gap: 0; font-size: 10pt; justify-content: flex-end; }',
    '.sign-label { white-space: nowrap; font-size: 10pt; }',
    '.sign-line { flex: 0 0 28mm; border-bottom: 1px solid #999; margin: 0 4mm 2px; }',
    '.sign-box { border: 1px solid #777; width: 21mm; height: 9mm; display: inline-flex; align-items: center; justify-content: center; font-size: 7.5pt; color: #999; flex-shrink: 0; }',
    '.recipient-row { display: flex; justify-content: space-between; align-items: center; font-size: 10pt; margin-top: 2.5mm; border-top: 1px solid #DDD; padding-top: 2mm; }',
    '.homeroom-wrap { display: flex; align-items: center; gap: 2.5mm; }',
    '.homeroom { font-size: 9.5pt; color: #444; }',
    '.stamp-box { border: 1px solid #777; width: 14mm; height: 14mm; display: flex; align-items: center; justify-content: center; font-size: 6.5pt; color: #bbb; }'
  ].join('\n');
}

function buildApprovalHTML() {
  return '<div class="approval-section">' +
    '<div class="ap-vertical">결재</div>' +
    '<table class="ap-table">' +
      '<tr class="ap-name-row">' +
        '<td>계</td>' +
        '<td style="font-size:5.5pt;font-weight:700;vertical-align:middle;text-align:center;padding:1px;">교육행정지원부장</td>' +
        '<td>교감</td>' +
        '<td>교장</td>' +
      '</tr>' +
      '<tr class="ap-sign-row">' +
        '<td></td>' +
        '<td></td>' +
        '<td><span class="jeongyeol-sign">전결</span></td>' +
        '<td style="padding:0;background:#FFFFFF;border:1.5px solid #333;overflow:hidden;">' +
          '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 210 140" preserveAspectRatio="none" ' +
               'style="display:block;width:100%;height:14mm;background:#FFFFFF;">' +
            '<line x1="0" y1="0" x2="210" y2="140" stroke="#999999" stroke-width="3"/>' +
          '</svg>' +
        '</td>' +
      '</tr>' +
    '</table>' +
  '</div>';
}

function buildKindTableHTML(data) {
  var type    = data.type;
  var subType = data.absenceSubType || '질병결';

  function cb(active) { return active ? '<span class="check-mark">V</span>' : '□'; }

  var cbJilbyeong = cb(type === '결석' && subType === '질병결');
  var cbInjeong   = cb(type === '결석' && subType === '인정결');
  var cbJoetoe    = cb(type === '조퇴');
  var cbJigak     = cb(type === '지각');
  var cbGyeolgwa  = cb(type === '결과');

  var absencePeriod  = type === '결석' ? escapeHtml(data.dateText) : '';
  var joetoePeriod   = type === '조퇴' ? escapeHtml(data.dateText) : '';
  var jigakPeriod    = type === '지각' ? escapeHtml(data.dateText) : '';
  var gyeolgwaPeriod = type === '결과' ? escapeHtml(data.dateText) : '';

  return '<table class="kind-tbl">' +
    '<tr>' +
      '<th class="kind-header" rowspan="8">종류</th>' +
      '<td class="kind-item" colspan="2">' +
        '<div class="kind-item-pair">' +
          '<span>' + cbJilbyeong + ' 질병결</span>' +
          '<span>' + cbInjeong + ' 인정결</span>' +
        '</div>' +
      '</td>' +
    '</tr>' +
    '<tr><td class="kind-period" colspan="2">기간 : ' + absencePeriod + '</td></tr>' +
    '<tr><td class="kind-item" colspan="2">' + cbJoetoe + ' 인정조퇴</td></tr>' +
    '<tr><td class="kind-period" colspan="2">기간 : ' + joetoePeriod + '</td></tr>' +
    '<tr><td class="kind-item" colspan="2">' + cbJigak + ' 인정지각</td></tr>' +
    '<tr><td class="kind-period" colspan="2">기간 : ' + jigakPeriod + '</td></tr>' +
    '<tr><td class="kind-item" colspan="2">' + cbGyeolgwa + ' 인정결과</td></tr>' +
    '<tr><td class="kind-period" colspan="2">기간 : ' + gyeolgwaPeriod + '</td></tr>' +
  '</table>';
}

function buildNoticeHTML() {
  var bu = 'font-weight:bold;text-decoration:underline;';
  var u  = 'text-decoration:underline;';
  return '<div class="notice-box">' +
    '<p>※ 신고서는 <span style="' + bu + '">결석한 날부터 5일 이내에</span> 제출하여야 하고, 관련 근거 서류를 첨부하시기 바랍니다.</p>' +
    '<p><span style="' + bu + '">기한 내 미제출시 미인정 처리되니 유의</span>하시기 바랍니다.</p>' +
    '<p>- <span style="' + bu + '">생리결석/조퇴/지각/결과 : 보호자의견서 작성</span></p>' +
    '<p>- 독감 : 독감검사 음성확인서, 독감검사 양성확인서(<span style="' + u + '">격리기간 명시</span>)</p>' +
    '<p>- 경조사 : 해당 증빙서류 (<span style="' + u + '">가족관계증명서 포함</span>)</p>' +
    '<p>- 질병결석 1～2일 : <span style="' + u + '">진료확인서, 처방전 등 제출 또는 보호자의견서 작성</span></p>' +
    '<p>- 질병결석 3일 이상 : <span style="' + u + '">진단서, 의사소견서, 입퇴원확인서</span> 등</p>' +
  '</div>';
}

function buildFooterHTML(data) {
  var typeText    = escapeHtml(data.type);
  var confirmDate = escapeHtml(data.confirmDate || '');

  return '<div class="submit-section">' +
    '<div class="submit-text">위와 같은 사유로 ' + typeText + ' 신고서를 제출합니다.</div>' +
    '<div class="submit-date">' + confirmDate + '</div>' +
  '</div>' +
  '<div class="sign-wrap">' +
    '<div class="sign-item">' +
      '<span class="sign-label">보 호 자 :</span>' +
      '<div class="sign-line"></div>' +
      '<div class="sign-box">(인 또는 서명)</div>' +
    '</div>' +
    '<div class="sign-item">' +
      '<span class="sign-label">학&nbsp;&nbsp;&nbsp;&nbsp;생 :</span>' +
      '<div class="sign-line"></div>' +
      '<div class="sign-box">(인 또는 서명)</div>' +
    '</div>' +
  '</div>' +
  '<div class="recipient-row">' +
    '<span>미림여자고등학교장 귀하</span>' +
    '<div class="homeroom-wrap">' +
      '<span class="homeroom">담임교사</span>' +
      '<div class="stamp-box">(인)</div>' +
    '</div>' +
  '</div>';
}

function generateDocumentHTML(data, autoprint, autoDownload) {
  var typeText = escapeHtml(data.type) + ' 신고서';
  var fileName = data.type + '_' + data.grade + '학년' + data.classNum + '반' + data.number + '번_' + escapeHtml(data.name);

  var scriptBlock = '';
  if (!autoprint || autoDownload) {
    scriptBlock = [
      '<script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"><\/script>',
      '<script src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"><\/script>',
      '<script>',
      'function downloadPDF() {',
      '  var actions = document.getElementById("preview-actions");',
      '  var notice = document.getElementById("preview-notice");',
      '  if (actions) actions.style.display = "none";',
      '  if (notice) notice.style.display = "none";',
      '  var jsPDF = window.jspdf.jsPDF;',
      '  var el = document.getElementById("doc-content");',
      '  html2canvas(el, { scale: 2, useCORS: true, backgroundColor: "#ffffff" }).then(function(canvas) {',
      '    if (actions) actions.style.display = "flex";',
      '    if (notice) notice.style.display = "block";',
      '    var pdf = new jsPDF("p", "mm", "a4");',
      '    var pw = pdf.internal.pageSize.getWidth();',
      '    var ph = pdf.internal.pageSize.getHeight();',
      '    var iw = canvas.width;',
      '    var ih = canvas.height;',
      '    var ratio = pw / iw;',
      '    var ch = ih * ratio;',
      '    if (ch <= ph) {',
      '      pdf.addImage(canvas.toDataURL("image/png"), "PNG", 0, 0, pw, ch);',
      '    } else {',
      '      var pages = Math.ceil(ch / ph);',
      '      for (var i = 0; i < pages; i++) {',
      '        if (i > 0) pdf.addPage();',
      '        pdf.addImage(canvas.toDataURL("image/png"), "PNG", 0, -(i * ph), pw, ch);',
      '      }',
      '    }',
      '    pdf.save("' + fileName + '.pdf");',
      '  });',
      '}',
      '<\/script>'
    ].join('\n');
  }

  var autoPrintScript = autoDownload
    ? '<script>window.onload = function(){ downloadPDF(); };<\/script>'
    : (autoprint ? '<script>window.onload = function(){ window.print(); };<\/script>' : '');

  var actionsHTML = (autoprint || autoDownload) ? '' : [
    '<div id="preview-actions" style="display:flex;gap:10px;margin-bottom:20px;justify-content:center;flex-wrap:wrap;">',
    '<button onclick="window.print()" style="padding:10px 24px;background:#1565C0;color:white;border:none;border-radius:6px;font-size:1rem;cursor:pointer;font-family:inherit;">인쇄</button>',
    '<button onclick="downloadPDF()" style="padding:10px 24px;background:#37474F;color:white;border:none;border-radius:6px;font-size:1rem;cursor:pointer;font-family:inherit;">PDF 저장</button>',
    '<button onclick="window.close()" style="padding:10px 24px;background:#ECEFF1;color:#37474F;border:none;border-radius:6px;font-size:1rem;cursor:pointer;font-family:inherit;">닫기</button>',
    '</div>',
    '<p id="preview-notice" style="text-align:center;font-size:0.82rem;color:#888;margin-bottom:16px;font-family:\'Malgun Gothic\',\'맑은 고딕\',sans-serif;">PDF 저장 시 잠시 기다려주세요.</p>'
  ].join('');

  var studentInfo = escapeHtml(data.grade) + '학년 ' + escapeHtml(data.classNum) + '반 ' + escapeHtml(data.number) + '번';

  var infoTableHTML =
    '<div style="display:flex;justify-content:flex-end;margin-bottom:2mm;">' +
      '<table style="border-collapse:collapse;width:50mm;">' +
        '<tr>' +
          '<th style="border:1.5px solid #333;background:#F5F5F5;font-weight:700;width:18mm;' +
               'text-align:center;font-size:9pt;padding:1.5mm 2mm;vertical-align:middle;">소&nbsp;&nbsp;속</th>' +
          '<td style="border:1.5px solid #333;font-size:9pt;padding:1.5mm 2mm;">' + studentInfo + '</td>' +
        '</tr>' +
        '<tr>' +
          '<th style="border:1.5px solid #333;background:#F5F5F5;font-weight:700;' +
               'text-align:center;font-size:9pt;padding:1.5mm 2mm;vertical-align:middle;">이&nbsp;&nbsp;름</th>' +
          '<td style="border:1.5px solid #333;font-size:9pt;padding:1.5mm 2mm;">' + escapeHtml(data.name) + '</td>' +
        '</tr>' +
      '</table>' +
    '</div>';

  var docBody =
    buildApprovalHTML() +
    infoTableHTML +
    buildKindTableHTML(data) +
    '<table class="reason-tbl">' +
      '<tr><th>사&nbsp;&nbsp;&nbsp;유</th><td class="reason-content">' + (escapeHtmlNl(data.reason) || '&nbsp;') + '</td></tr>' +
    '</table>' +
    buildNoticeHTML() +
    '<table class="parent-tbl">' +
      '<tr>' +
        '<th>보호자<br>의견서</th>' +
        '<td><div class="parent-content">' + (escapeHtmlNl(data.parentNote) || '&nbsp;') + '</div></td>' +
      '</tr>' +
    '</table>' +
    buildFooterHTML(data);

  return '<!DOCTYPE html>\n' +
    '<html lang="ko">\n<head>\n' +
    '<meta charset="UTF-8">\n' +
    '<meta name="viewport" content="width=device-width, initial-scale=1.0">\n' +
    '<title>' + typeText + '</title>\n' +
    scriptBlock + '\n' +
    autoPrintScript + '\n' +
    '<style>\n' + buildDocCSS() + '\n</style>\n' +
    '</head>\n<body>\n' +
    actionsHTML +
    '<div class="doc-wrap" id="doc-content">\n' +
    '<h1 class="doc-title">' + typeText + '</h1>\n' +
    docBody +
    '</div>\n</body>\n</html>';
}

// ====================================================================
// PDF 미리보기 / 저장 (폼 화면)
// ====================================================================

function previewPDF() {
  var data = collectFormData();
  if (!data) return;
  var html = generateDocumentHTML(data, false);
  var win = window.open('', '_blank');
  if (!win) { alert('팝업이 차단되었습니다. 브라우저에서 팝업을 허용해주세요.'); return; }
  win.document.write(html);
  win.document.close();
}

function savePDF() {
  var data = collectFormData();
  if (!data) return;
  var html = generateDocumentHTML(data, false, true);
  var win = window.open('', '_blank');
  if (!win) { alert('팝업이 차단되었습니다. 브라우저에서 팝업을 허용해주세요.'); return; }
  win.document.write(html);
  win.document.close();
}

// ====================================================================
// 대시보드에서 미리보기 / 인쇄
// ====================================================================

function reportToDisplayData(report) {
  var dateText = '';
  if (report.type === '결석') {
    dateText = report.absencePeriod || '';
  } else if (report.type === '조퇴') {
    dateText = (report.leaveDate || '') + (report.leavePeriod ? ' ' + report.leavePeriod + '부터 조퇴' : '');
  } else if (report.type === '지각') {
    dateText = (report.lateDate || '') + (report.latePeriod ? ' ' + report.latePeriod + '까지 지각' : '');
  } else if (report.type === '결과') {
    var gd = report.gyeolgwaDate  || '';
    var gs = report.gyeolgwaStart || '';
    var ge = report.gyeolgwaEnd   || '';
    dateText = gd + ' ' + buildGyeolgwaText(gs, ge);
  }
  return {
    type:           report.type,
    absenceSubType: report.absenceSubType || '질병결',
    grade:          report.grade    || '',
    classNum:       report.classNum || '',
    number:         report.number   || '',
    name:           report.name     || '',
    dateText:       dateText,
    reason:         report.reason      || '',
    parentNote:     report.parentNote  || '',
    confirmDate:    report.confirmDate || ''
  };
}

async function previewReportById(id) {
  var report = await getReportById(id);
  if (!report) return;
  var html = generateDocumentHTML(reportToDisplayData(report), false);
  var win = window.open('', '_blank');
  if (!win) { alert('팝업이 차단되었습니다. 브라우저에서 팝업을 허용해주세요.'); return; }
  win.document.write(html);
  win.document.close();
}

async function printReportById(id) {
  var report = await getReportById(id);
  if (!report) return;
  var html = generateDocumentHTML(reportToDisplayData(report), true);
  var win = window.open('', '_blank');
  if (!win) { alert('팝업이 차단되었습니다. 브라우저에서 팝업을 허용해주세요.'); return; }
  win.document.write(html);
  win.document.close();
}

// ====================================================================
// 대시보드 (index.html)
// ====================================================================

function loadDashboard() {
  applyFilters();
}

async function applyFilters() {
  var grade = (document.getElementById('filter-grade') || {}).value || '';
  var cls   = (document.getElementById('filter-class') || {}).value || '';
  var type  = (document.getElementById('filter-type')  || {}).value || '';

  // 로딩 표시
  var tbody = document.getElementById('reports-body');
  var table = document.getElementById('reports-table');
  var emptyState = document.getElementById('empty-state');
  if (tbody) tbody.innerHTML = '<tr><td colspan="7" class="loading-row">불러오는 중...</td></tr>';
  if (table) table.style.display = 'table';
  if (emptyState) emptyState.classList.add('hidden');

  var all = await getReports();

  var sTotal    = document.getElementById('stat-total');
  var sAbsent   = document.getElementById('stat-absent');
  var sEarly    = document.getElementById('stat-early');
  var sLate     = document.getElementById('stat-late');
  var sGyeolgwa = document.getElementById('stat-gyeolgwa');

  if (sTotal)    sTotal.textContent    = all.length;
  if (sAbsent)   sAbsent.textContent   = all.filter(function(r){ return r.type === '결석'; }).length;
  if (sEarly)    sEarly.textContent    = all.filter(function(r){ return r.type === '조퇴'; }).length;
  if (sLate)     sLate.textContent     = all.filter(function(r){ return r.type === '지각'; }).length;
  if (sGyeolgwa) sGyeolgwa.textContent = all.filter(function(r){ return r.type === '결과'; }).length;

  var filtered = all;
  if (grade) filtered = filtered.filter(function(r){ return r.grade    === grade; });
  if (cls)   filtered = filtered.filter(function(r){ return r.classNum === cls;   });
  if (type)  filtered = filtered.filter(function(r){ return r.type     === type;  });

  renderReportsList(filtered);
}

function renderReportsList(reports) {
  var tbody      = document.getElementById('reports-body');
  var emptyState = document.getElementById('empty-state');
  var table      = document.getElementById('reports-table');
  var countEl    = document.getElementById('result-count');

  if (countEl) countEl.textContent = reports.length > 0 ? reports.length + '건' : '';
  if (!tbody)  return;

  if (reports.length === 0) {
    tbody.innerHTML = '';
    if (emptyState) emptyState.classList.remove('hidden');
    if (table)      table.style.display = 'none';
    return;
  }

  if (emptyState) emptyState.classList.add('hidden');
  if (table)      table.style.display = 'table';

  tbody.innerHTML = reports.map(function(r) {
    var created = new Date(r.createdAt);
    var dateStr = created.getFullYear() + '.' +
      String(created.getMonth() + 1).padStart(2, '0') + '.' +
      String(created.getDate()).padStart(2, '0');

    var dateInfo = '';
    if (r.type === '결석')      dateInfo = r.absencePeriod || '';
    else if (r.type === '조퇴') dateInfo = r.leaveDate     || '';
    else if (r.type === '지각') dateInfo = r.lateDate      || '';
    else if (r.type === '결과') dateInfo = r.gyeolgwaDate  || '';

    var badgeMap = { '결석': 'badge-absent', '조퇴': 'badge-early', '지각': 'badge-late', '결과': 'badge-gyeolgwa' };
    var badgeClass = badgeMap[r.type] || 'badge-absent';
    var reason = (r.reason || '').substring(0, 18) + ((r.reason || '').length > 18 ? '…' : '');

    return '<tr>' +
      '<td style="white-space:nowrap">' + dateStr + '</td>' +
      '<td>' + escapeHtml(r.grade) + '학년 ' + escapeHtml(r.classNum) + '반 ' + escapeHtml(r.number) + '번</td>' +
      '<td><strong>' + escapeHtml(r.name) + '</strong></td>' +
      '<td><span class="badge ' + badgeClass + '">' + escapeHtml(r.type) + '</span></td>' +
      '<td class="hide-mobile" style="font-size:0.82rem;color:#546E7A;">' + escapeHtml(dateInfo) + '</td>' +
      '<td class="hide-mobile" style="color:#757575;">' + escapeHtml(reason) + '</td>' +
      '<td>' +
        '<div class="action-btns">' +
          '<a href="form.html?id=' + r.id + '" class="btn btn-sm btn-outline">수정</a>' +
          '<button onclick="previewReportById(\'' + r.id + '\')" class="btn btn-sm btn-secondary">미리보기</button>' +
          '<button onclick="printReportById(\'' + r.id + '\')" class="btn btn-sm btn-outline">인쇄</button>' +
          '<button onclick="confirmDelete(\'' + r.id + '\')" class="btn btn-sm btn-danger">삭제</button>' +
        '</div>' +
      '</td>' +
    '</tr>';
  }).join('');
}

async function confirmDelete(id) {
  var r = await getReportById(id);
  if (!r) return;
  if (confirm(r.name + ' (' + r.type + ') 신고서를 삭제하시겠습니까?')) {
    await deleteReportById(id);
    loadDashboard();
  }
}

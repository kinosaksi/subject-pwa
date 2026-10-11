let fieldData = [];
let deptData = [];
let fieldToDepts = {};

// 업로드 파일 최대 크기 (20MB)
const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

// 계열 및 학과 데이터 (직접 입력)
const departmentData = {
    "언어·문학": "국어국문학과, 동양어학과, 서양어학과, 영어영문학과, 통번역학과",
    "인문과학": "고고학과, 문화재보존학과, 문화콘텐츠학과, 문헌정보학과, 사학과, 인류학과, 철학과",
    "상경": "경영학과, 경제학과, 금융보험학과, 무역·유통학과, 세무·회계학과, 호텔·관광경영학과",
    "광고언론정보": "광고홍보학과, 언론정보학과, 정보미디어학과",
    "사회_": "국제학과, 사회학과, 사회복지학과, 심리학과, 아동학과, 정치외교학과, 지리학과, 항공서비스학과",
    "법·행정": "법학과, 보건행정학과, 행정학과",
    "자연과학": "대기과학과, 물리학과, 생명과학과, 수학과, 지질학과, 천문학과, 통계학과, 화학과",
    "생활과학": "식품영양학과, 의류학과",
    "농학": "식물자원학과, 동물자원학과, 원예학과, 조경학과",
    "기계·전기·전자": "기계공학과, 스마트모빌리티학과, 전기공학과, 전자공학과, 제어계측공학과, 항공우주공학과, 항공운항학과",
    "정보·컴퓨터": "컴퓨터공학과, 소프트웨어학과, 인공지능학과, 빅데이터학과, 정보통신공학과, 정보보안학과, 멀티미디어학과, 융합학과, 산업공학과",
    "건축·환경": "건축학과, 건축공학과, 교통공학과, 도시공학과, 토목공학과, 해양공학과, 환경공학과",
    "화학·생명": "생명공학과, 섬유공학과, 식품공학과, 신소재공학과, 에너지자원공학과, 재료공학과, 화장품과학과, 화학공학과",
    "보건": "간호학과, 물리치료학과, 응급구조학과, 임상병리학과, 재활치료학과, 치기공학과, 치위생학과",
    "의약학": "수의학과, 약학과, 의예과, 치의예과, 한의예과",
    "교육": "언어 교과 교육과, 사회 교과 교육과, 수학교육과, 과학 교과 교육과, 교육학과, 초등교육과, 유아교육과",
    "예술": "회화과, 조소과, 공예과(조형학과), 디자인과, 미술교육과, 성악과, 피아노과, 관현악과, 작곡과, 한국음악과, 음악교육과, 연극영화학과, 영상학과, 사진학과, 문예창작학과",
    "체육": "체육학과, 스포츠과학과, 체육교육과, 스포츠의학과, 스포츠경영학과, 무용학과"
};

// 엑셀 셀 값을 HTML로 출력하기 전에 특수문자를 이스케이프 (XSS 방지)
function escapeHTML(value) {
    if (value === undefined || value === null) return '';
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// 이스케이프 후 줄바꿈만 <br>로 변환
function formatText(value) {
    return escapeHTML(value).replace(/\r?\n/g, '<br>');
}

// 이스케이프 후 글머리 기호(•) 앞에서 줄바꿈
function formatBullets(value) {
    return formatText(value).replace(/•/g, '<br>• ');
}

// IndexedDB 설정
const dbName = "DepartmentSearchDB";
const storeName = "excelData";
// 이전 버전은 HTML 조각(<br>)을 섞어 저장했으므로 새 키를 사용
const cacheKey = "excelData-v2";
let db;

const request = indexedDB.open(dbName, 1);
request.onupgradeneeded = function(event) {
    db = event.target.result;
    db.createObjectStore(storeName, { keyPath: "id" });
};
request.onsuccess = function(event) {
    db = event.target.result;
    loadCachedData();
    loadDefaultExcel();
};
request.onerror = function() {
    // IndexedDB를 쓸 수 없는 환경(사생활 보호 모드 등)에서도 동작
    loadDefaultExcel();
};

function saveToIndexedDB() {
    if (!db) return;
    try {
        const transaction = db.transaction([storeName], "readwrite");
        const store = transaction.objectStore(storeName);
        store.put({ id: cacheKey, fieldData, deptData, fieldToDepts });
        document.getElementById('upload-status').textContent = "데이터가 저장되었습니다.";
    } catch (e) {
        console.error('IndexedDB 저장 실패:', e);
    }
}

function loadCachedData() {
    const transaction = db.transaction([storeName], "readonly");
    const store = transaction.objectStore(storeName);
    const request = store.get(cacheKey);
    request.onsuccess = function(event) {
        const cached = event.target.result;
        if (cached && Array.isArray(cached.deptData) && cached.fieldToDepts && typeof cached.fieldToDepts === 'object') {
            fieldData = cached.fieldData || [];
            deptData = cached.deptData;
            fieldToDepts = cached.fieldToDepts;
            updateFieldDropdown();
            document.getElementById('upload-status').textContent = "캐시된 데이터가 로드되었습니다.";
        }
    };
}

function updateFieldDropdown() {
    const fieldSelect = document.getElementById('field');
    fieldSelect.innerHTML = '<option value="">선택하세요</option>';
    Object.keys(fieldToDepts).sort().forEach(field => {
        const option = document.createElement('option');
        option.value = field;
        option.textContent = field;
        fieldSelect.appendChild(option);
    });
}

// 엑셀 워크북에서 계열/학과 데이터 추출
function parseWorkbook(workbook) {
    const fieldSheet = workbook.Sheets['계열 데이터'];
    const deptSheet = workbook.Sheets['학과 데이터'];
    if (!fieldSheet || !deptSheet) {
        throw new Error("'계열 데이터' 또는 '학과 데이터' 시트가 없습니다.");
    }

    // "계열 데이터" 시트 파싱
    const newFieldData = XLSX.utils.sheet_to_json(fieldSheet, { header: ['계열', '관련 학과'], skipHeader: false })
        .slice(1)
        .filter(row => row['계열'] && row['관련 학과']);
    // 프로토타입이 없는 객체를 사용해 '__proto__' 같은 키로 인한 오염 방지
    const newFieldToDepts = Object.create(null);
    newFieldData.forEach(row => {
        newFieldToDepts[String(row['계열'])] = String(row['관련 학과']).split(',').map(dept => dept.trim());
    });

    // "학과 데이터" 시트 파싱
    const newDeptData = XLSX.utils.sheet_to_json(deptSheet, { header: [
        '학과', '학과설명', '전공 기초', '전공 심화', '이런 학생에게 추천', '유사학과',
        '개설대학(한큐에 넣기)', '개설대학(서울)', '개설대학(수도권)', '개설대학(지방)',
        '개설대학(서울)(입력)', '개설대학(수도권)(입력)', '개설대학(지방)(입력)',
        '졸업 후 진로', '일반선택', '진로선택', '융합선택'
    ], skipHeader: false }).slice(1).filter(row => row['학과']);

    fieldData = newFieldData;
    fieldToDepts = newFieldToDepts;
    deptData = newDeptData;
}

// 계열별 학과 목록 모달 열기
document.getElementById('show-department-list').addEventListener('click', function() {
    const modal = document.getElementById('department-modal');
    const modalDepartments = document.getElementById('modal-departments');
    let tableContent = '<tr><th class="w-1/4">계열</th><th class="w-3/4">학과</th></tr>';

    for (const [field, departments] of Object.entries(departmentData)) {
        const deptList = departments.split(', ').map(escapeHTML).join('<br>');
        tableContent += `<tr><td>${escapeHTML(field)}</td><td>${deptList}</td></tr>`;
    }

    modalDepartments.innerHTML = tableContent;
    modal.style.display = 'block';
});

// 모달 닫기
document.getElementById('close-modal').addEventListener('click', function() {
    document.getElementById('department-modal').style.display = 'none';
});

// 기본 Excel 파일 자동 로드
function loadDefaultExcel() {
    document.getElementById('loading').style.display = 'block';
    fetch('과목선택.xlsx')
        .then(response => {
            if (!response.ok) throw new Error('Excel 파일을 찾을 수 없습니다.');
            return response.arrayBuffer();
        })
        .then(data => {
            const workbook = XLSX.read(new Uint8Array(data), { type: 'array' });
            parseWorkbook(workbook);
            saveToIndexedDB();
            updateFieldDropdown();
            document.getElementById('loading').style.display = 'none';
        })
        .catch(error => {
            console.error('기본 Excel 로드 실패:', error);
            document.getElementById('loading').style.display = 'none';
            document.getElementById('admin-section').classList.add('active');
            document.getElementById('admin-error').style.display = 'block';
        });
}

// Excel 파일 업로드 (관리자 섹션)
document.getElementById('excel-upload').addEventListener('change', function(event) {
    const file = event.target.files[0];
    if (!file) return;

    const adminError = document.getElementById('admin-error');
    if (file.size > MAX_UPLOAD_BYTES) {
        adminError.textContent = '파일이 너무 큽니다. (최대 20MB)';
        adminError.style.display = 'block';
        return;
    }

    document.getElementById('loading').style.display = 'block';
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const workbook = XLSX.read(new Uint8Array(e.target.result), { type: 'array' });
            parseWorkbook(workbook);
            saveToIndexedDB();
            updateFieldDropdown();
            document.getElementById('upload-status').textContent = "수동 업로드 완료.";
            adminError.style.display = 'none';
        } catch (err) {
            console.error('업로드 파일 처리 실패:', err);
            adminError.textContent = 'Excel 파일을 읽지 못했습니다. 파일 형식과 시트 이름을 확인해 주세요.';
            adminError.style.display = 'block';
        } finally {
            document.getElementById('loading').style.display = 'none';
        }
    };
    reader.readAsArrayBuffer(file);
});

// 계열 선택 시 학과 드롭다운 업데이트
document.getElementById('field').addEventListener('change', function() {
    const field = this.value;
    const deptSelect = document.getElementById('department');
    deptSelect.innerHTML = '<option value="">선택하세요</option>';
    if (field && Object.prototype.hasOwnProperty.call(fieldToDepts, field)) {
        fieldToDepts[field].slice().sort().forEach(dept => {
            const option = document.createElement('option');
            option.value = dept;
            option.textContent = dept;
            deptSelect.appendChild(option);
        });
    }
});

// 검색 버튼 클릭
document.getElementById('search-btn').addEventListener('click', function() {
    const department = document.getElementById('department').value;
    const resultsDiv = document.getElementById('results');
    resultsDiv.innerHTML = '';

    if (!department) {
        resultsDiv.innerHTML = '<p class="text-red-500 text-center">학과를 선택하세요.</p>';
        return;
    }

    const result = deptData.find(row => row['학과'] === department);
    if (!result) {
        resultsDiv.innerHTML = '<p class="text-red-500 text-center">검색 결과가 없습니다.</p>';
        return;
    }

    const majorCourses = formatText(result['전공 기초']) +
        (result['전공 심화'] ? '<br>(전공 심화)<br>' + formatText(result['전공 심화']) : '');

    // 모든 엑셀 값은 escapeHTML/formatText/formatBullets를 거쳐 출력
    const table = document.createElement('table');
    table.className = 'result-table mx-auto';
    table.innerHTML = `
        <tr><th colspan="3" class="text-center">학과 설명</th></tr>
        <tr><td colspan="3">${formatText(result['학과설명'])}</td></tr>
        <tr><th colspan="3" class="text-center">일반선택과목 예시</th></tr>
        <tr><td colspan="3">${formatText(result['일반선택'])}</td></tr>
        <tr><th colspan="3" class="text-center">진로선택과목 예시</th></tr>
        <tr><td colspan="3">${formatText(result['진로선택'])}</td></tr>
        <tr><th colspan="3" class="text-center">융합선택과목 예시</th></tr>
        <tr><td colspan="3">${formatText(result['융합선택'])}</td></tr>
        <tr><th colspan="3" class="text-center">대학 전공 과목</th></tr>
        <tr><td colspan="3">${majorCourses}</td></tr>
        <tr><th colspan="3" class="text-center">이런 학생에게 추천</th></tr>
        <tr><td colspan="3">${formatBullets(result['이런 학생에게 추천'])}</td></tr>
        <tr><th colspan="3" class="text-center">유사학과</th></tr>
        <tr><td colspan="3">${formatText(result['유사학과'])}</td></tr>
        <tr>
            <th class="college-th" rowspan="3">개설<br>대학</th>
            <td class="border px-2 py-2 font-bold w-[15%]">서울</td>
            <td class="border px-2 py-2 w-[70%]">${formatText(result['개설대학(서울)'])}</td>
        </tr>
        <tr>
            <td class="border px-2 py-2 font-bold w-[15%]">수도권</td>
            <td class="border px-2 py-2 w-[70%]">${formatText(result['개설대학(수도권)'])}</td>
        </tr>
        <tr>
            <td class="border px-2 py-2 font-bold w-[15%]">지방</td>
            <td class="border px-2 py-2 w-[70%]">${formatText(result['개설대학(지방)'])}</td>
        </tr>
        <tr><th colspan="3" class="text-center">졸업 후 진로</th></tr>
        <tr><td colspan="3">${formatBullets(result['졸업 후 진로'])}</td></tr>
    `;
    resultsDiv.appendChild(table);
});

// PWA Service Worker
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('service-worker.js')
        .then(reg => console.log('Service Worker 등록 성공:', reg.scope))
        .catch(err => console.error('Service Worker 등록 실패:', err));
}

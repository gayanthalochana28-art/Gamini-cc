/* =============================================================
   SRI GAMINI CENTRAL COLLEGE — data layer (localStorage demo)
   Exposes: window.SGC.db

   ⚠ DEMO STORAGE. localStorage is a browser key/value store with no
   access control, no query language and no privacy guarantees. It is used
   here only so the front end is fully functional without a server.
   See README → "Replacing localStorage" for the Firebase / Supabase /
   PHP+MySQL swap points. Every read and write goes through the six
   functions below, so the whole layer can be replaced without touching
   a single page.
   ============================================================= */
(function (global) {
  'use strict';

  const SGC = global.SGC = global.SGC || {};
  const PREFIX = 'sgc.';

  /* Relative-to-today dates keep the demo looking alive whenever it is run. */
  const DAY = 86400000;
  const d = (offset) => new Date(Date.now() + offset * DAY).toISOString();
  const day = (offset) => d(offset).slice(0, 10);

  const COLLECTIONS = [
    'schoolSettings', 'schoolUsers', 'schoolStudents', 'schoolTeachers',
    'schoolClasses', 'schoolSubjects', 'schoolNotices', 'schoolUpdates',
    'schoolEvents', 'schoolGallery', 'schoolAchievements', 'schoolDownloads',
    'schoolMessages', 'schoolAttendance', 'schoolResults', 'schoolAssignments',
    'schoolTimetable', 'schoolSubmissions', 'schoolUserPrefs',
  ];

  /* ---------------- seed content ---------------- */

  const SEED_SUBJECTS = [
    { id: 'SUB01', name: 'Sinhala', nameSi: 'සිංහල', code: 'SIH', band: 'Primary / Secondary', department: 'Languages', core: true },
    { id: 'SUB02', name: 'English', nameSi: 'ඉංග්‍රීසි', code: 'ENG', band: 'Primary / Secondary', department: 'Languages', core: true },
    { id: 'SUB03', name: 'Mathematics', nameSi: 'ගණිතය', code: 'MAT', band: 'Primary / Secondary', department: 'Mathematics', core: true },
    { id: 'SUB04', name: 'Science', nameSi: 'විද්‍යාව', code: 'SCI', band: 'Junior / Senior Secondary', department: 'Science', core: true },
    { id: 'SUB05', name: 'Information & Communication Technology', nameSi: 'තොරතුරු හා සන්නිවේදන තාක්ෂණය', code: 'ICT', band: 'Junior Secondary', department: 'Technology', core: true },
    { id: 'SUB06', name: 'History', nameSi: 'ඉතිහාසය', code: 'HIS', band: 'Secondary', department: 'Humanities', core: true },
    { id: 'SUB07', name: 'Geography', nameSi: 'භූගෝල විද්‍යාව', code: 'GEO', band: 'Secondary', department: 'Humanities', core: false },
    { id: 'SUB08', name: 'Commerce', nameSi: 'වාණිජ විද්‍යාව', code: 'COM', band: 'Senior Secondary / Advanced Level', department: 'Commerce', core: false },
    { id: 'SUB09', name: 'Accounting', nameSi: 'ගණන්කම', code: 'ACC', band: 'Advanced Level', department: 'Commerce', core: false },
    { id: 'SUB10', name: 'Business Studies', nameSi: 'ව්‍යාපාර අධ්‍යයන', code: 'BST', band: 'Advanced Level', department: 'Commerce', core: false },
    { id: 'SUB11', name: 'Physics', nameSi: 'භෞතික විද්‍යාව', code: 'PHY', band: 'Advanced Level', department: 'Science', core: false },
    { id: 'SUB12', name: 'Chemistry', nameSi: 'රසායන විද්‍යාව', code: 'CHE', band: 'Advanced Level', department: 'Science', core: false },
    { id: 'SUB13', name: 'Biology', nameSi: 'ජීව විද්‍යාව', code: 'BIO', band: 'Advanced Level', department: 'Science', core: false },
    { id: 'SUB14', name: 'Combined Mathematics', nameSi: 'සංයුක්ත ගණිතය', code: 'CMB', band: 'Advanced Level', department: 'Mathematics', core: false },
    { id: 'SUB15', name: 'Drama', nameSi: 'නාට්‍ය කලාව', code: 'DRM', band: 'Senior Secondary', department: 'Arts', core: false },
    { id: 'SUB16', name: 'Visual Arts', nameSi: 'දෘශ්‍ය කලාව', code: 'ART', band: 'Secondary', department: 'Arts', core: false },
    { id: 'SUB17', name: 'Music (Eastern)', nameSi: 'පෙරදිග සංගීතය', code: 'MUS', band: 'Secondary', department: 'Arts', core: false },
    { id: 'SUB18', name: 'Buddhist Studies', nameSi: 'බෞද්ධ ධර්මය', code: 'BUD', band: 'Secondary', department: 'Religion', core: false },
    { id: 'SUB19', name: 'Health & Physical Education', nameSi: 'සෞඛ්‍ය හා කායික අධ්‍යයනය', code: 'HPE', band: 'All grades', department: 'Sports', core: true },
    { id: 'SUB20', name: 'Tamil', nameSi: 'දමිළ', code: 'TAM', band: 'Secondary', department: 'Languages', core: false },
    { id: 'SUB21', name: 'Design & Technology', nameSi: 'නිර්මාණ හා තාක්ෂණ', code: 'DTC', band: 'Senior Secondary', department: 'Technology', core: false },
    { id: 'SUB22', name: 'Agriculture', nameSi: 'ගොවිතැන් විද්‍යාව', code: 'AGR', band: 'Senior Secondary', department: 'Science', core: false },
  ];

  const SEED_CLASSES = [
    { id: 'CLS6A', name: 'Grade 6 - A', grade: 6, stream: 'Parallel', room: 'Block A / 01', capacity: 45 },
    { id: 'CLS6B', name: 'Grade 6 - B', grade: 6, stream: 'Parallel', room: 'Block A / 02', capacity: 45 },
    { id: 'CLS7A', name: 'Grade 7 - A', grade: 7, stream: 'Parallel', room: 'Block A / 03', capacity: 45 },
    { id: 'CLS8A', name: 'Grade 8 - A', grade: 8, stream: 'Parallel', room: 'Block B / 01', capacity: 45 },
    { id: 'CLS8B', name: 'Grade 8 - B', grade: 8, stream: 'Parallel', room: 'Block B / 02', capacity: 45 },
    { id: 'CLS9A', name: 'Grade 9 - A', grade: 9, stream: 'Parallel', room: 'Block B / 04', capacity: 45 },
    { id: 'CLS9B', name: 'Grade 9 - B', grade: 9, stream: 'Parallel', room: 'Block B / 05', capacity: 45 },
    { id: 'CLS10A', name: 'Grade 10 - Science', grade: 10, stream: 'Science', room: 'Block C / 01', capacity: 40 },
    { id: 'CLS10B', name: 'Grade 10 - Commerce', grade: 10, stream: 'Commerce', room: 'Block C / 02', capacity: 40 },
    { id: 'CLS11A', name: 'Grade 11 - A', grade: 11, stream: 'Parallel', room: 'Block C / 04', capacity: 45 },
    { id: 'CLS11B', name: 'Grade 11 - B', grade: 11, stream: 'Parallel', room: 'Block C / 05', capacity: 45 },
    { id: 'CLS12P', name: 'Grade 12 - Physical Science', grade: 12, stream: 'Physical Science', room: 'Hall Block / 01', capacity: 35 },
    { id: 'CLS12B', name: 'Grade 12 - Biological Science', grade: 12, stream: 'Biological Science', room: 'Hall Block / 02', capacity: 35 },
    { id: 'CLS12C', name: 'Grade 12 - Commerce', grade: 12, stream: 'Commerce', room: 'Hall Block / 03', capacity: 35 },
    { id: 'CLS13P', name: 'Grade 13 - Physical Science', grade: 13, stream: 'Physical Science', room: 'Hall Block / 04', capacity: 35 },
    { id: 'CLS13A', name: 'Grade 13 - Arts', grade: 13, stream: 'Arts', room: 'Hall Block / 05', capacity: 35 },
  ];

  const SEED_TEACHERS = [
    {
      id: 'T001', teacherId: 'T001', fullName: 'Sunil Bandara Perera',
      department: 'Technology', position: 'Senior Teacher / Head of ICT Department',
      subjectIds: ['SUB05', 'SUB21'], phone: '071 245 8890', email: 's.b.perera@sgcc.sch.lk',
      address: 'No. 18/2, Pothuhera Road, Mahamathwala',
      bio: 'B.Sc. (Special) in Computer Science, University of Peradeniya; Postgraduate Diploma in Teaching (PGDT), University of Colombo. Twenty-two years in the classroom and eleven leading the college ICT programme, including the island-wide Open Source migration of the college computer laboratory.',
      joinedOn: day(-4017), status: 'Active', photo: '',
    },
    {
      id: 'T002', teacherId: 'T002', fullName: 'Chandima Wickramasinghe',
      department: 'Mathematics', position: 'Principal Teacher in Mathematics',
      subjectIds: ['SUB03', 'SUB14'], phone: '077 331 4402', email: 'c.wickramasinghe@sgcc.sch.lk',
      address: 'No. 405, Main Street, Wariyapola',
      bio: 'B.Sc. in Mathematics, University of Colombo; M.Ed. in Mathematics Education, University of Sri Jayewardenepura. Regional coordinator for the Mathematics Enrichment Circle and author of two G.C.E. A/L revision workbooks.',
      joinedOn: day(-7305), status: 'Active', photo: '',
    },
    {
      id: 'T003', teacherId: 'T003', fullName: 'Ruwan Jayasuriya',
      department: 'Science', position: 'Senior Teacher in Chemistry',
      subjectIds: ['SUB04', 'SUB12'], phone: '071 887 2213', email: 'r.jayasuriya@sgcc.sch.lk',
      address: 'No. 12A, Temple Road, Eluwankulama',
      bio: 'B.Sc. in Chemistry, University of Peradeniya; National Institute of Education certified in Practical Science Pedagogy. Rebuilt the college chemistry laboratories and mentors the provincial Chemistry Olympiad team.',
      joinedOn: day(-5478), status: 'Active', photo: '',
    },
    {
      id: 'T004', teacherId: 'T004', fullName: 'Nirosha Fernando',
      department: 'Languages', position: 'Teacher in English',
      subjectIds: ['SUB02'], phone: '076 220 9918', email: 'n.fernando@sgcc.sch.lk',
      address: 'No. 77, Lake View Drive, Anuradhapura',
      bio: 'B.A. in English Literature, University of Kelaniya; CELTA (Cambridge). Convenes the college English Literature Festival and the debating team, and runs the after-hours Speech and Drama clinic.',
      joinedOn: day(-2190), status: 'Active', photo: '',
    },
    {
      id: 'T005', teacherId: 'T005', fullName: 'Pradeep Kumara Silva',
      department: 'Commerce', position: 'Senior Teacher / Head of Commerce Stream',
      subjectIds: ['SUB08', 'SUB09', 'SUB10'], phone: '071 404 6621', email: 'p.k.silva@sgcc.sch.lk',
      address: 'No. 3, New Town, Mihintale',
      bio: 'B.Com. (Special) in Accounting, University of Kelaniya; part-qualified accountant (CMA Sri Lanka). Founded the college Young Entrepreneurs Society, which has placed first at the national level three times.',
      joinedOn: day(-6209), status: 'Active', photo: '',
    },
  ];

  const SEED_STUDENTS = [
    { id: 'S001', studentId: 'S001', admissionNo: '2019/1148', fullName: 'Sanula Pathum Perera', nameWithInitials: 'S.P.Perera', dob: '2010-04-18', gender: 'Male', grade: 12, classId: 'CLS12P', guardianName: 'Mahesh Perera', relationship: 'Father', phone: '071 555 0142', email: 'sanula.perera@student.sgcc.sch.lk', address: 'No. 24, Pothuhera Road, Mahamathwala', status: 'Active', photo: '' },
    { id: 'S002', studentId: 'S002', admissionNo: '2019/1163', fullName: 'Dinusha Ishara Jayawardana', nameWithInitials: 'D.I.Jayawardana', dob: '2010-09-02', gender: 'Female', grade: 12, classId: 'CLS12C', guardianName: 'Kamala Jayawardana', relationship: 'Mother', phone: '077 812 3390', email: 'dinusha.j@student.sgcc.sch.lk', address: 'No. 8/1, Station Road, Wariyapola', status: 'Active', photo: '' },
    { id: 'S003', studentId: 'S003', admissionNo: '2020/0912', fullName: 'Kavindu Sachintha Rathnayake', nameWithInitials: 'K.S.Rathnayake', dob: '2011-01-27', gender: 'Male', grade: 11, classId: 'CLS11A', guardianName: 'Sunil Rathnayake', relationship: 'Father', phone: '071 660 7714', email: 'kavindu.r@student.sgcc.sch.lk', address: 'No. 112, Anuradhapura Road, Eluwankulama', status: 'Active', photo: '' },
    { id: 'S004', studentId: 'S004', admissionNo: '2020/0934', fullName: 'Tharushi Nethmini Bandara', nameWithInitials: 'T.N.Bandara', dob: '2011-06-11', gender: 'Female', grade: 11, classId: 'CLS11B', guardianName: 'Rohana Bandara', relationship: 'Father', phone: '076 445 2208', email: 'tharushi.b@student.sgcc.sch.lk', address: 'No. 41, Temple Road, Mihintale', status: 'Active', photo: '' },
    { id: 'S005', studentId: 'S005', admissionNo: '2021/0655', fullName: 'Sasindu Dineth Fernando', nameWithInitials: 'S.D.Fernando', dob: '2012-03-05', gender: 'Male', grade: 10, classId: 'CLS10A', guardianName: 'Ajith Fernando', relationship: 'Father', phone: '071 233 8876', email: 'sasindu.f@student.sgcc.sch.lk', address: 'No. 6, Lake View Drive, Anuradhapura', status: 'Active', photo: '' },
    { id: 'S006', studentId: 'S006', admissionNo: '2021/0671', fullName: 'Amaya Kavirani Wickramage', nameWithInitials: 'A.K.Wickramage', dob: '2012-11-23', gender: 'Female', grade: 10, classId: 'CLS10B', guardianName: 'Shirani Wickramage', relationship: 'Mother', phone: '077 990 1123', email: 'amaya.w@student.sgcc.sch.lk', address: 'No. 90, New Town, Mihintale', status: 'Active', photo: '' },
    { id: 'S007', studentId: 'S007', admissionNo: '2022/0418', fullName: 'Yashas Sameera Dissanayake', nameWithInitials: 'Y.S.Dissanayake', dob: '2013-07-30', gender: 'Male', grade: 9, classId: 'CLS9A', guardianName: 'Chaminda Dissanayake', relationship: 'Father', phone: '071 774 5510', email: 'yashas.d@student.sgcc.sch.lk', address: 'No. 17/3, Main Street, Wariyapola', status: 'Active', photo: '' },
    { id: 'S008', studentId: 'S008', admissionNo: '2022/0442', fullName: 'Nethmini Sachini Gunawardena', nameWithInitials: 'N.S.Gunawardena', dob: '2013-02-14', gender: 'Female', grade: 9, classId: 'CLS9B', guardianName: 'Varuni Gunawardena', relationship: 'Mother', phone: '076 318 7742', email: 'nethmini.g@student.sgcc.sch.lk', address: 'No. 203, Pothuhera Road, Mahamathwala', status: 'Active', photo: '' },
    { id: 'S009', studentId: 'S009', admissionNo: '2023/0288', fullName: 'Ravindu Sadun Sampath', nameWithInitials: 'R.S.Sampath', dob: '2014-12-08', gender: 'Male', grade: 7, classId: 'CLS7A', guardianName: 'Lalith Sampath', relationship: 'Father', phone: '071 509 3321', email: 'ravindu.s@student.sgcc.sch.lk', address: 'No. 31, Anuradhapura Road, Eluwankulama', status: 'Active', photo: '' },
    { id: 'S010', studentId: 'S010', admissionNo: '2024/0107', fullName: 'Hasali Nethmi Premathilake', nameWithInitials: 'H.N.Premathilake', dob: '2015-05-19', gender: 'Female', grade: 6, classId: 'CLS6A', guardianName: 'Roshan Premathilake', relationship: 'Father', phone: '077 662 4419', email: 'hasali.p@student.sgcc.sch.lk', address: 'No. 5, Temple Road, Mihintale', status: 'Active', photo: '' },
  ];

  const SEED_NOTICES = [
    {
      id: 'N001', title: 'Grade 11 and 13 Term II Examination — Final Timetable', titleSi: '11 සහ 13 ශ්‍රේණි දෙවන වාර විභාගය — අවසන් කාලසටහන',
      body: 'The Grade 11 and Grade 13 second term examinations will be held from Monday to Friday of next week in the morning session commencing 8.30 a.m. Candidates must report to their examination halls twenty minutes before each paper, bring the college examination pass, and are reminded that calculators are permitted only for Mathematics, Combined Mathematics, Chemistry and Physics papers. Hall lists are displayed on the main block notice board.',
      bodySi: '11 සහ 13 ශ්‍රේණි දෙවන වාර විභාගය ඊළඟ සතියේ පෙරවරු 8.30 ට පැවැත්වේ.',
      date: d(-2), expiryDate: day(12), category: 'Exam', priority: 'High',
      audience: ['student', 'teacher', 'parent'], attachment: { name: 'al-term2-timetable.pdf', size: 148480, type: 'application/pdf' },
      author: 'Examinations Department', published: true, views: 412, createdAt: d(-2), updatedAt: d(-1),
    },
    {
      id: 'N002', title: 'Annual Sports Meet — Selection Trials Begin Monday', titleSi: 'වාර්ෂික ක්‍රීඩා උළුසේ — තේරීමේ තරඟ සඳුදා ආරම්භ වේ',
      body: 'Selection trials for the 75th Annual Sports Meet begin next Monday at the college ground from 2.15 p.m. Athletes should register with their house captains before Friday evening. Events on the first day are the 100m, 200m, 400m, 800m and the long jump. Spikes and house colours are compulsory; a medical clearance form is required for any student entering more than two events.',
      bodySi: '75 වන වාර්ෂික ක්‍රීඩා තරඟාවලියේ තේරීමේ තරඟ සඳුදා ප.ව. 2.15 ට පැවැත්වේ.',
      date: d(-4), expiryDate: day(20), category: 'Sports', priority: 'Normal',
      audience: ['student', 'teacher'], attachment: null,
      author: 'Department of Sports', published: true, views: 268, createdAt: d(-4), updatedAt: d(-4),
    },
    {
      id: 'N003', title: 'Term Holiday and Reopening Arrangements', titleSi: 'වාර නිවාඩු සහ නැවත ආරම්භ කිරීම',
      body: 'The college will close at the end of the current term and reopen on the first Monday of next month. Boarders must vacate the hostels by 12 noon on the closing day. The bursary will remain open for fee payments on the two days preceding closure, and the library will issue extended-loan tickets for holiday reading.',
      bodySi: 'වාරය අවසානයේ පාසල වසන අතර ඊළඟ මාසයේ පළමු සඳුදා නැවත විවෘත කෙරේ.',
      date: d(-8), expiryDate: day(35), category: 'Holiday', priority: 'Normal',
      audience: ['student', 'teacher', 'parent'], attachment: null,
      author: "Principal's Office", published: true, views: 934, createdAt: d(-8), updatedAt: d(-8),
    },
    {
      id: 'N004', title: 'School Bus Route No. 3 — Temporary Diversion', titleSi: 'පාසල් බස් 3 වන මාර්ගය — තාවකාලික මාර්ග වෙනස',
      body: 'Owing to bridge repair works on the main road, Route No. 3 will divert through the temple road for the next three weeks from next Monday. Morning pick-up times on that route will be fifteen minutes earlier than published. Updated timetables are available from the transport office and in the Downloads section of this website.',
      bodySi: 'පාලම අලුත්වැඩියා නිසා 3 අංක බස් මාර්ගය විහාර මාර්ගය හරහා මාරු කෙරේ.',
      date: d(-1), expiryDate: day(25), category: 'Administration', priority: 'High',
      audience: ['student', 'parent'], attachment: { name: 'route-3-diversion.pdf', size: 61440, type: 'application/pdf' },
      author: 'Transport Office', published: true, views: 157, createdAt: d(-1), updatedAt: d(-1),
    },
    {
      id: 'N005', title: 'Parent–Teacher Meeting for Grades 6 to 11', titleSi: '6 සිට 11 ශ්‍රේණි දක්වා දෙමව්පියන් හා ගුරුවරුන් හමුවීම',
      body: 'The mid-year parent–teacher meeting for Grades 6 through 11 will be held next Saturday. Class teachers will distribute progress reports at 9.00 a.m., followed by subject consultations until 12.30 p.m. Parents are requested to attend with the student. Advanced Level students have a separate session the following week.',
      bodySi: '6 සිට 11 ශ්‍රේණි දක්වා දෙමව්පියන් හා ගුරුවරුන් හමුවීම සෙනසුරාදා පැවැත්වේ.',
      date: d(-6), expiryDate: day(9), category: 'General', priority: 'Normal',
      audience: ['parent', 'teacher'], attachment: null,
      author: "Principal's Office", published: true, views: 521, createdAt: d(-6), updatedAt: d(-6),
    },
    {
      id: 'N006', title: 'Draft: Library Book Fair Volunteer Call', titleSi: 'සටහන: පුස්තකාල පොත් ප්‍රදර්ශනයට ස්වේච්ඡකයන්',
      body: 'Internal draft — awaiting confirmation of the hall booking. Do not publish until the culture department confirms dates.',
      bodySi: '',
      date: d(-3), expiryDate: '', category: 'Events', priority: 'Low',
      audience: ['teacher'], attachment: null,
      author: 'Library', published: false, views: 0, createdAt: d(-3), updatedAt: d(-3),
    },
    {
      id: 'N007', title: 'Outstanding Library Fines — Clearance Before Reopening', titleSi: '',
      body: 'Students who borrowed reference sets during the first term were required to clear their accounts before the vacation. This notice has now expired; outstanding cases are handled individually by the librarian on return.',
      bodySi: '',
      date: d(-40), expiryDate: day(-8), category: 'Academic', priority: 'Normal',
      audience: ['student'], attachment: null,
      author: 'Library', published: true, views: 289, createdAt: d(-40), updatedAt: d(-8),
    },
  ];

  const SEED_UPDATES = [
    {
      id: 'U001', title: 'College wins national ICT innovation challenge', titleSi: 'ජාතික තොරතුරු තාක්ෂණ නවෝත්පාදන තරඟයේ ශූරතාව දිනා ගනී',
      excerpt: 'A Grade 13 team from the college ICT society took first place at the national innovation challenge held in Colombo, beating forty-two schools with a low-cost attendance system built entirely on open-source software.',
      content: 'The three-member team spent eight months designing a fingerprint-based attendance terminal that runs on a single-board computer and costs under a tenth of the commercial alternatives.\n\nJudges cited the project\'s reliability in low-bandwidth rural school settings, where the prototype was tested across four schools in the district before the final. The society now plans to release the design files freely to any school that requests them.\n\nThe award follows a strong year for the department, whose students have also placed in the provincial programming olympiad for the third consecutive year.',
      image: 'assets/gallery/g01.jpg', date: d(-1), category: 'Achievement', author: 'Media Unit', views: 1284, likes: 216, featured: true,
    },
    {
      id: 'U002', title: 'New science laboratory block declared open', titleSi: 'නව විද්‍යාගාර ගොඩනැගිල්ල විවෘත කෙරේ',
      excerpt: 'The college physics and chemistry laboratories have reopened after an eight-month refurbishment funded jointly by the Ministry of Education and the college development fund.',
      content: 'The upgraded block adds two purpose-built practical rooms, a fume-extraction system, and a dedicated preparation store that had been absent since the original building was opened.\n\nEvery bench now carries an isolated power supply and a gas tap, allowing the practical syllabus to be delivered without the timetabling compromises that constrained the department in recent years.\n\nThe college thanks the development society parents\' committee, whose annual dinner raised the matching contribution that unlocked the government grant.',
      image: 'assets/gallery/g02.jpg', date: d(-5), category: 'Facilities', author: 'Media Unit', views: 902, likes: 143, featured: true,
    },
    {
      id: 'U003', title: 'Under-17 football team reaches provincial final', titleSi: 'අවුරුදු 17න් පහළ පාපන්දු කණ්ඩායම පළාත් අවසන් පූර්ව වටයට',
      excerpt: 'The college under-17 football side secured a place in the provincial knockout final with a late victory in the semi-final played away last Saturday.',
      content: 'Trailing with twelve minutes remaining, the college equalised from a set piece and won the tie deep in stoppage time, sending the travelling supporters home early.\n\nThe squad has conceded only twice in five matches this campaign. Goalkeeping has been the standout, with the first-choice keeper keeping four clean sheets.\n\nThe final is scheduled for the middle of next month at the district stadium, and the college is arranging extra bus transport for students wishing to attend.',
      image: 'assets/gallery/g03.jpg', date: d(-9), category: 'Sports', author: 'Department of Sports', views: 1673, likes: 388, featured: false,
    },
    {
      id: 'U004', title: 'Poson festival: college observes a full programme', titleSi: '',
      excerpt: 'Students and staff observed a full day of religious and cultural activities marking the college Poson observance, culminating in an alms-giving to two nearby schools.',
      content: 'The day opened with a dhamma talk by the chief incumbent of the temple that sponsors the college, followed by a sinhala and english poetry session organised by the literature society.\n\nIn the afternoon the student council coordinated an alms-giving supporting two smaller schools in the division, an event the council has now run for four consecutive years.\n\nThe college closed the day with a collective meditation session in the main hall.',
      image: 'assets/gallery/g04.jpg', date: d(-14), category: 'Cultural', author: 'Buddhist Society', views: 641, likes: 97, featured: false,
    },
    {
      id: 'U005', title: 'Grade 13 results: college passes 94 per cent', titleSi: '13 ශ්‍රේණි ප්‍රතිඵල: 94% සමත් වේ',
      excerpt: 'The college recorded its strongest Advanced Level results in a decade, with ninety-four per cent of school candidates obtaining university admission eligibility.',
      content: 'Thirty-one students passed in all three subjects with combined credit passes, and the physical science stream returned the highest proportion of distictions in the district.\n\nThe mathematics department attributes the improvement to the tutorial programme introduced two years ago, which adds supervised evening practice for every A/L stream.\n\nIndividual results are available from the bursary from next week; the college does not publish results by name.',
      image: 'assets/gallery/g05.jpg', date: d(-21), category: 'Academic', author: "Principal's Office", views: 2210, likes: 402, featured: false,
    },
    {
      id: 'U006', title: 'Draft: feature on the college brass band', titleSi: 'සටහන: පාසල් තඹ වාද්‍ය වෘන්දය',
      excerpt: 'Awaiting photographs from the culture department before publication.',
      content: 'Working draft. Interview notes with the bandmaster to follow.',
      image: '', date: d(-2), category: 'Cultural', author: 'Media Unit', views: 0, likes: 0, featured: false,
      status: 'Draft', published: false,
    },
  ];

  const SEED_EVENTS = [
    { id: 'E001', title: '75th Annual Sports Meet', titleSi: '75 වන වාර්ෂික ක්‍රීඩා උළුසේ', date: day(18), startTime: '08:00', endTime: '17:00', venue: 'College Ground', venueSi: 'පාසල් ක්‍රීඩාංගණය', category: 'Sports', organizer: 'Department of Sports', image: 'assets/gallery/g06.jpg', description: 'Track events from 8.00 a.m., house parades at 2.00 p.m., and the presentation of the challenge shield by the chief guest in the evening. Parents are welcome; the refreshment stall is run by the parents\' committee.' },
    { id: 'E002', title: 'G.C.E. A/L University Zoning Guidance Seminar', titleSi: 'උ.පෙ. පො. සා. විශ්වවිද්‍යාල ඇතුළත් කිරීම් මග පෙන්වීම', date: day(6), startTime: '09:30', endTime: '13:00', venue: 'Main Auditorium', venueSi: 'ප්‍රධාන ශ්‍රවණාගාරය', category: 'Academic', organizer: 'Careers Guidance Unit', image: 'assets/gallery/g07.jpg', description: 'A guidance session for Advanced Level students and their parents on the university admission and zoning process, run together with the divisional education officer.' },
    { id: 'E003', title: 'Inter-House Singing Competition', titleSi: 'අන්තර් නිවස ගීත තරඟය', date: day(11), startTime: '14:00', endTime: '18:30', venue: 'Hall of Fame', venueSi: 'කීර්ති ශාලාව', category: 'Cultural', organizer: 'Culture Society', image: 'assets/gallery/g08.jpg', description: 'Four houses compete in solo, group song and dance categories. Entry cards close with house captains three days before the event.' },
    { id: 'E004', title: 'Alumni Career Day', titleSi: 'පරණ ශිෂ්ය වෘත්තීය මග පෙන්වීමේ දිනය', date: day(27), startTime: '10:00', endTime: '15:30', venue: 'Science Block Courtyard', venueSi: 'විද්‍යා ගොඩනැගිල්ල', category: 'Career', organizer: 'Old Boys\' Union', image: 'assets/gallery/g09.jpg', description: 'Twenty-five alumni from medicine, engineering, law, commerce and the arts return to speak with O/L and A/L students about career routes after school.' },
    { id: 'E005', title: 'Book Exchange Fair', titleSi: 'පොත් හුවමාරු ප්‍රදර්ශනය', date: day(38), startTime: '09:00', endTime: '14:00', venue: 'College Library', venueSi: 'පාසල් පුස්තකාලය', category: 'Academic', organizer: 'Library', image: 'assets/gallery/g10.jpg', description: 'Students may exchange up to three set books per term. The library will also open its rare collections and run a reading challenge for junior grades.' },
    { id: 'E006', title: 'Parent–Teacher Association Annual Dinner', titleSi: 'දෙමව්පියන් හා ගුරුවරුන්ගේ වාර්ෂික රාත්‍රී ආහාරය', date: day(-42), startTime: '19:00', endTime: '23:00', venue: 'Hotel Gal Oya, Anuradhapura', venueSi: 'ආනුරාධපුරය', category: 'Administration', organizer: 'Development Society', image: 'assets/gallery/g02.jpg', description: 'The fundraising dinner that underwrites the college development fund for the coming year. Tickets were distributed through class teachers.' },
    { id: 'E007', title: 'District Under-15 Cricket Tournament', titleSi: 'දිස්ත්‍රික් අවුරුදු 15න් පහළ ක්‍රිකට් තරඟාවලිය', date: day(-15), startTime: '09:00', endTime: '17:00', venue: 'District Stadium', venueSi: 'දිස්ත්‍රික් ක්‍රීඩාංගණය', category: 'Sports', organizer: 'Department of Sports', image: 'assets/gallery/g03.jpg', description: 'College entered two sides in the district knockout and reached the quarter-final stage before elimination.' },
  ];

  const SEED_GALLERY = [
    { id: 'G01', title: 'Main block at first light', category: 'School', src: 'assets/gallery/g01.jpg', date: day(-40), caption: 'The original 1950s block, still in daily use.' },
    { id: 'G02', title: 'New science laboratories', category: 'School', src: 'assets/gallery/g02.jpg', date: day(-30), caption: 'Refurbished physics and chemistry practical rooms.' },
    { id: 'G03', title: 'Under-17 football semi-final', category: 'Sports', src: 'assets/gallery/g03.jpg', date: day(-9), caption: 'Stoppage-time winner in the provincial semi-final.' },
    { id: 'G04', title: 'Poson day alms-giving', category: 'Cultural', src: 'assets/gallery/g04.jpg', date: day(-14), caption: 'Student council members at the annual dāna.' },
    { id: 'G05', title: 'Advanced Level prize giving', category: 'Competitions', src: 'assets/gallery/g05.jpg', date: day(-21), caption: 'Presentation of subject prizes by the chief guest.' },
    { id: 'G06', title: 'Inter-house athletics', category: 'Sports', src: 'assets/gallery/g06.jpg', date: day(-60), caption: 'The 400m hurdles at the annual sports meet.' },
    { id: 'G07', title: 'Robotics club workshop', category: 'Educational', src: 'assets/gallery/g07.jpg', date: day(-18), caption: 'Students assembling line-following robots.' },
    { id: 'G08', title: 'Vesak lantern competition', category: 'Cultural', src: 'assets/gallery/g08.jpg', date: day(-120), caption: 'House lanterns displayed along the main avenue.' },
    { id: 'G09', title: 'Shaka and bhikkhu outreach', category: 'Students', src: 'assets/gallery/g09.jpg', date: day(-75), caption: 'The Buddhist society visiting a rural school.' },
    { id: 'G10', title: 'Teaching staff development day', category: 'Teachers', src: 'assets/gallery/g10.jpg', date: day(-95), caption: 'In-service training on practical science teaching.' },
  ];

  const SEED_ACHIEVEMENTS = [
    { id: 'A001', title: 'First place — National ICT Innovation Challenge', recipient: 'Kavindu Rathnayake, Sasindu Fernando, Yashas Dissanayake', date: day(-30), level: 'National', category: 'Academic', image: 'assets/gallery/g01.jpg', description: 'Judged first among forty-two schools for a low-cost biometric attendance terminal built from open-source components.' },
    { id: 'A002', title: 'Provincial Science Olympiad — Silver', recipient: 'Grade 13 Chemistry squad', date: day(-110), level: 'Provincial', category: 'Academic', image: 'assets/gallery/g02.jpg', description: 'Two silver and three bronze medals, the college\'s best haul in the competition\'s eleven-year history.' },
    { id: 'A003', title: 'District Under-17 Football — Runners-up', recipient: 'College first XI', date: day(-9), level: 'District', category: 'Sports', image: 'assets/gallery/g03.jpg', description: 'Reached the provincial final conceding only two goals across five knockout matches.' },
    { id: 'A004', title: 'National Schools\' Sinhala Poetry — First', recipient: 'Tharushi Bandara', date: day(-150), level: 'National', category: 'Cultural', image: 'assets/gallery/g04.jpg', description: 'First place in the Sinhala verse category at the island-wide Sinhala literary competition.' },
    { id: 'A005', title: 'Best School Project — Techno Zone', recipient: 'ICT Society', date: day(-200), level: 'National', category: 'Academic', image: 'assets/gallery/g07.jpg', description: 'Awarded for the community mapping project documenting water points across the division.' },
    { id: 'A006', title: 'All-Island Art Exhibition — Merit', recipient: 'Hasali Premathilake', date: day(-64), level: 'National', category: 'Cultural', image: 'assets/gallery/g08.jpg', description: 'Merit award in the under-12 watercolour section of the all-island schools\' exhibition.' },
  ];

  const SEED_DOWNLOADS = [
    { id: 'D001', title: 'Grade 11 & 13 Term II Examination Timetable', category: 'Exam Papers', fileName: 'term2-exam-timetable.pdf', url: '', size: 148480, date: day(-2), description: 'Final morning-session timetable with hall lists and permitted equipment.' },
    { id: 'D002', title: 'School Bus Route 3 Revised Timetable', category: 'Timetables', fileName: 'route-3-diversion.pdf', url: '', size: 61440, date: day(-1), description: 'Temporary diversion timings while bridge repairs continue.' },
    { id: 'D003', title: 'Grade 10 Admission Application Form', category: 'Forms', fileName: 'grade10-admission-form.pdf', url: '', size: 92160, date: day(-45), description: 'Application form for grade 10 admission, with the schedule of required documents.' },
    { id: 'D004', title: 'Annual Fee Structure Circular', category: 'Circulars', fileName: 'fee-structure-circular.pdf', url: '', size: 51200, date: day(-70), description: 'Ministry circular setting the approved fee structure for national schools.' },
    { id: 'D005', title: 'Past Paper Collection — Combined Mathematics', category: 'Exam Papers', fileName: 'cm-past-papers-2015-2024.zip', url: '', size: 4812800, date: day(-25), description: 'Ten years of island-wide combined mathematics past papers with marking schemes.' },
    { id: 'D006', title: 'Term II School Calendar', category: 'Timetables', fileName: 'term2-calendar.pdf', url: '', size: 204800, date: day(-33), description: 'Full term calendar including exams, sports, holidays and PTA dates.' },
  ];

  const SEED_MESSAGES = [
    { id: 'M001', from: 'S003', fromName: 'Kavindu Rathnayake', to: 'T001', subject: 'Robotics club project deadline', body: 'Sir, may I have until Friday to submit the line-follower chassis? The motor driver module was out of stock at three shops.', date: d(-1), read: false, threadId: 'TH001', role: 'student' },
    { id: 'M002', from: 'T002', fromName: 'Chandima Wickramasinghe', to: 'admin', subject: 'Extra tutorial room for Grade 13', body: 'We need the hall on Thursday evenings for combined mathematics tutorials. Please confirm room availability.', date: d(-2), read: false, threadId: 'TH002', role: 'teacher' },
    { id: 'M003', from: 'S002', fromName: 'Dinusha Jayawardana', to: 'T005', subject: 'Commerce stream subject choice', body: 'Madam, I would like to change my third subject from Business Studies to Accounting. Whose approval do I need?', date: d(-3), read: true, threadId: 'TH003', role: 'student' },
    { id: 'M004', from: 'admin', fromName: "Principal's Office", to: 'all', subject: 'Staff meeting agenda for next week', body: 'Agenda: examination supervision roster, sports meet logistics, and the library volunteer call. Please review before Monday.', date: d(-4), read: true, threadId: 'TH004', role: 'admin' },
    { id: 'M005', from: 'S007', fromName: 'Yashas Dissanayake', to: 'T003', subject: 'Absent from chemistry practical', body: 'Sir, I was at the district under-15 cricket match on Tuesday. Can I sit the practical assessment again?', date: d(-5), read: true, threadId: 'TH005', role: 'student' },
    { id: 'M006', from: 'T002', fromName: 'Chandima Wickramasinghe', to: 'S001', subject: 'Combined mathematics — tutorial group', body: 'You have been placed in the Thursday tutorial group for combined mathematics. Bring the problem set issued last week; we will work through the complex number questions together.', date: d(-1), read: false, threadId: 'TH006', role: 'teacher' },
    { id: 'M007', from: 'admin', fromName: "Principal's Office", to: 'S001', subject: 'Library books due next week', body: 'The office records three borrowed titles against your card, all due before the end of the month. Please clear them at the library desk during break.', date: d(-2), read: false, threadId: 'TH007', role: 'admin' },
  ];

  /* Assignments the demo student has already handed in. */
  const SEED_SUBMISSIONS = [
    { id: 'SUBM001', assignmentId: 'AS005', studentId: 'S002', submittedAt: d(-2), note: 'Completed during the study period.' },
  ];

  /* Attendance for the last five school days, generated so the dashboards
     have something real to aggregate. */
  function buildAttendance() {
    const out = [];
    const schoolDays = [-1, -2, -3, -5, -6];
    const patterns = {
      S001: 'PPPLL', S002: 'PPPPP', S003: 'PPAPP', S004: 'LPPPP', S005: 'PPPPP',
      S006: 'PPPLA', S007: 'PPPPP', S008: 'APPPP', S009: 'PPPPP', S010: 'PLPPP',
    };
    schoolDays.forEach((off, di) => {
      SEED_STUDENTS.forEach((s) => {
        const code = (patterns[s.id] || 'PPPPP')[di];
        out.push({
          id: 'ATT' + Math.abs(off) + s.id,
          date: day(off), studentId: s.id, classId: s.classId,
          status: code === 'P' ? 'Present' : code === 'A' ? 'Absent' : 'Late',
          markedBy: 'T00' + ((di % 5) + 1), reason: code === 'A' ? 'Guardian informed' : '',
        });
      });
    });
    return out;
  }

  function buildResults() {
    const out = [];
    const subjects = ['SUB02', 'SUB03', 'SUB04', 'SUB05', 'SUB06'];
    const marks = {
      S001: [78, 84, 71, 92, 66], S002: [88, 62, 59, 74, 81], S003: [69, 91, 83, 95, 58],
      S004: [92, 55, 64, 70, 87], S005: [74, 79, 88, 81, 62], S006: [85, 68, 72, 66, 90],
      S007: [61, 73, 69, 78, 71], S008: [79, 86, 77, 83, 65], S009: [66, 71, 62, 69, 74],
      S010: [83, 77, 81, 75, 79],
    };
    SEED_STUDENTS.forEach((s) => {
      subjects.forEach((sub, i) => {
        const m = marks[s.id][i];
        out.push({
          id: 'RES' + s.id + sub, studentId: s.id, subjectId: sub, classId: s.classId,
          examName: 'Term II Preliminary Examination', term: 'Term II', year: String(new Date().getFullYear()),
          marks: m, total: 100, grade: m >= 80 ? 'A' : m >= 75 ? 'B+' : m >= 70 ? 'B' : m >= 60 ? 'C' : m >= 50 ? 'S' : 'W',
          date: day(-12), enteredBy: 'T00' + ((i % 5) + 1),
        });
      });
    });
    return out;
  }

  function buildAssignments() {
    return [
      { id: 'AS001', classId: 'CLS12P', subjectId: 'SUB14', title: 'Complex numbers — problem set 4', instructions: 'Complete questions 1 to 12 from the worksheet. Show all working.', dueDate: day(3), assignedBy: 'T002', maxMarks: 20, createdAt: d(-2) },
      { id: 'AS002', classId: 'CLS12P', subjectId: 'SUB05', title: 'Database design coursework', instructions: 'Design an ER model for the college library, then produce the normalised schema to third normal form.', dueDate: day(7), assignedBy: 'T001', maxMarks: 40, createdAt: d(-4) },
      { id: 'AS003', classId: 'CLS11A', subjectId: 'SUB04', title: 'Titration practical report', instructions: 'Submit a full report of the acid-base titration carried out in Tuesday\'s practical.', dueDate: day(2), assignedBy: 'T003', maxMarks: 25, createdAt: d(-3) },
      { id: 'AS004', classId: 'CLS9A', subjectId: 'SUB02', title: 'Persuasive essay (350 words)', instructions: 'Write a persuasive essay on a topic of your choice. Focus on clear paragraph structure.', dueDate: day(5), assignedBy: 'T004', maxMarks: 15, createdAt: d(-1) },
      { id: 'AS005', classId: 'CLS12C', subjectId: 'SUB09', title: 'Ledger and trial balance exercise', instructions: 'Post the given transactions to ledger accounts and prepare a trial balance.', dueDate: day(-1), assignedBy: 'T005', maxMarks: 30, createdAt: d(-8) },
    ];
  }

  function buildTimetable() {
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
    const periods = ['08:00', '08:50', '09:40', '10:50', '11:40', '13:00'];
    const plan = {
      CLS12P: [['SUB14', 'T002'], ['SUB11', 'T003'], ['SUB12', 'T003'], ['SUB13', 'T003'], ['SUB02', 'T004'], ['SUB05', 'T001']],
      CLS11A: [['SUB03', 'T002'], ['SUB04', 'T003'], ['SUB02', 'T004'], ['SUB01', 'T005'], ['SUB05', 'T001'], ['SUB06', 'T005']],
      CLS9A: [['SUB03', 'T002'], ['SUB04', 'T003'], ['SUB02', 'T004'], ['SUB19', 'T005'], ['SUB05', 'T001'], ['SUB06', 'T005']],
    };
    const out = [];
    Object.keys(plan).forEach((cls) => plan[cls].forEach((row, pi) => {
      out.push({
        id: 'TT' + cls + pi, classId: cls, day: days[pi % 5], period: pi + 1,
        start: periods[pi], end: periods[pi].slice(0, 2) + ':' + (Number(periods[pi].slice(3, 5)) + 45),
        subjectId: row[0], teacherId: row[1], room: (SEED_CLASSES.find((c) => c.id === cls) || {}).room,
      });
    }));
    return out;
  }

  const SEED_SETTINGS = {
    schoolName: 'SRI GAMINI CENTRAL COLLEGE',
    schoolNameSi: 'ශ්‍රී ගාමිනී මධ්‍ය මහා විද්‍යාලය',
    schoolTag: 'National School',
    schoolTagSi: 'ජාතික පාසල',
    shortName: 'SGCC',
    founded: '1951',
    code: '4321',
    motto: 'Education for Service',
    mottoSi: 'සේවය සඳහා අධ්‍යාපනය',
    about: 'Sri Gamini Central College is a national school providing education from Grade 1 through Advanced Level. The college runs parallel, science, commerce and arts streams, a full secondary curriculum, and a broad programme of sport, culture and community service.',
    aboutSi: 'ශ්‍රී ගාමිනී මධ්‍ය මහා විද්‍යාලය යනු 1 වන ශ්‍රේණියේ සිට උසස් පෙළ දක්වා අධ්‍යාපනය ලබා දෙන ජාතික පාසලකි.',
    history: 'Founded in 1951 on two acres of land given by the village, the college opened with thirty-one pupils and three teachers. It was taken under state control in 1962, granted central college status in 1974, and declared a national school in 1998. The science block followed in 1987 and the hall of fame in 2004.',
    historySi: '1951 වර්ෂයේදී ආරම්භ වූ පාසල 1998 වර්ෂයේදී ජාතික පාසලක් බවට පත් විය.',
    vision: 'To develop confident, enquiring and compassionate young people who serve their communities with distinction.',
    visionSi: 'විශ්වාසවන්ත සහ කරුණාවන්ත තරුණ පරපුරක් බිහි කිරීම.',
    mission: 'Academic rigour in every stream, equal access to opportunity regardless of background, and a staff who know every student by name.',
    missionSi: 'පසුබිම නොසලකා සෑම ශිෂ්‍යයෙකුටම සමාන අවස්ථා සලසා දීම.',
    address: 'No. 42, Bandaranaike Mawatha, Wariyapola, Kurunegala District, North Western Province, Sri Lanka',
    addressSi: 'අංක 42, බණ්ඩාරනායක මාවත, වාරියපොළ, කුරුණෑගල, ශ්‍රී ලංකාව',
    phone: '+94 37 228 7140', phone2: '+94 37 228 7141',
    email: 'office@sgcc.sch.lk', email2: 'principal@sgcc.sch.lk',
    hours: 'Monday to Friday, 7.30 a.m. – 3.30 p.m.  •  Office open until 4.30 p.m.',
    mapQuery: 'Wariyapola',
    facebook: 'https://www.facebook.com/', instagram: '', youtube: '', linkedin: '',
    principal: {
      name: 'W. M. D. B. R. Sri Gunananda Thero',
      nameSi: 'වි. මු. ද. බී. ආර්. ශ්‍රී ගුණානන්ද උන්වහන්සේ',
      position: 'Principal',
      photo: '', since: '2019',
      message: 'It gives me great pleasure to welcome you to Sri Gamini Central College. For more than seven decades this college has served the young people of our division, and the trust that parents place in us has never wavered.\n\nOur task is simple to state and difficult to do: to know each student well enough to push them a little further than they would push themselves. We pursue that through strong academic results in every stream, but also through the sports ground, the stage, the library and the service projects that take our students beyond the school gate.\n\nI invite parents to be active partners in this work, and students to make full use of the opportunities here. A school is only as good as the use its students make of it.',
      messageSi: 'ශ්‍රී ගාමිනී මධ්‍ය මහා විද්‍යාලයට ඔබ සාදරයෙන් පිළිගනිමු.',
    },
    stats: { students: 1520, teachers: 104, classes: 52, years: 75, achievements: 68, laboratories: 6 },
    highlights: [
      { icon: '🎓', title: 'Advanced Level results', text: 'Ninety-four per cent of school candidates obtained university eligibility in the most recent sitting.' },
      { icon: '🔬', title: 'Practical science', text: 'Six laboratories, including the newly refurbished physics and chemistry blocks.' },
      { icon: '💻', title: 'ICT education', text: 'Computer laboratory with broadband access and an active robotics club.' },
      { icon: '🏉', title: 'Sport', text: 'Twenty-two sports, with provincial and national representation every year.' },
      { icon: '🎭', title: 'Culture', text: 'Poson observances, the inter-house festival, and an all-island drama entry every second year.' },
      { icon: '🤝', title: 'Community service', text: 'Student-led outreach to four smaller schools in the division.' },
    ],
    facilities: ['Science laboratories', 'Computer laboratory', 'Library of 14,000 volumes', 'Main auditorium', 'College ground and cricket nets', 'Two boys\' hostels', 'Boarding and medical room', 'Canteen', 'Buddhist, Christian and Hindu shrines', 'Solar power array'],
    values: [
      { title: 'Discipline', text: 'Regular attendance, punctuality and respect for the school day are the baseline of everything else.' },
      { title: 'Diligence', text: 'Effort is rewarded alongside result; tutorials are open to every stream, not only the strongest.' },
      { title: 'Respect', text: 'The college serves students of every community, and civility between them is non-negotiable.' },
      { title: 'Service', text: 'Every student takes part in at least one service project before leaving the college.' },
    ],
    announcement: {
      active: true,
      text: 'Grade 10 admission applications for the coming year close on the 30th. Forms are available in the Downloads section.',
      textSi: '10 ශ්‍රේණියේ ඇතුළත් කිරීම් ඊළඟ මස 30 වන දින අවසන් වේ.',
      link: 'pages/downloads.html',
    },
    theme: 'light', lang: 'en',
    footerNote: 'A national school under the Ministry of Education, Democratic Socialist Republic of Sri Lanka.',
  };

  /* Users are kept separate from profile records so that swapping to a real
     identity provider touches one table, not five. */
  const SEED_USERS = [
    { id: 'U-ADMIN', role: 'admin', identifier: 'admin', name: 'Administration Office', linkedId: '', demoPassword: 'admin123', status: 'Active', createdAt: d(-900), lastLogin: '' },
    { id: 'U-T001', role: 'teacher', identifier: 'T001', name: 'Sunil Bandara Perera', linkedId: 'T001', demoPassword: 'teacher123', status: 'Active', createdAt: d(-900), lastLogin: '' },
    { id: 'U-T002', role: 'teacher', identifier: 'T002', name: 'Chandima Wickramasinghe', linkedId: 'T002', demoPassword: 'teacher123', status: 'Active', createdAt: d(-900), lastLogin: '' },
    { id: 'U-T003', role: 'teacher', identifier: 'T003', name: 'Ruwan Jayasuriya', linkedId: 'T003', demoPassword: 'teacher123', status: 'Active', createdAt: d(-900), lastLogin: '' },
    { id: 'U-T004', role: 'teacher', identifier: 'T004', name: 'Nirosha Fernando', linkedId: 'T004', demoPassword: 'teacher123', status: 'Active', createdAt: d(-900), lastLogin: '' },
    { id: 'U-T005', role: 'teacher', identifier: 'T005', name: 'Pradeep Kumara Silva', linkedId: 'T005', demoPassword: 'teacher123', status: 'Active', createdAt: d(-900), lastLogin: '' },
  ].concat(SEED_STUDENTS.map((s) => ({
    id: 'U-' + s.id, role: 'student', identifier: s.studentId, name: s.fullName,
    linkedId: s.id, demoPassword: 'student123', status: 'Active', createdAt: d(-600), lastLogin: '',
  })));

  /* ---------------- storage primitives ---------------- */

  function readRaw(key, fallback) {
    try {
      const v = localStorage.getItem(PREFIX + key);
      return v === null ? fallback : JSON.parse(v);
    } catch (err) {
      console.warn('[SGC] could not read ' + key + ' — falling back to seed.', err);
      return fallback;
    }
  }

  function writeRaw(key, value) {
    try {
      localStorage.setItem(PREFIX + key, JSON.stringify(value));
      return true;
    } catch (err) {
      SGC.utils.toast('Storage is full — the change was not saved.', 'error', 5000);
      return false;
    }
  }

  const SEEDS = {
    schoolSettings: () => SEED_SETTINGS,
    schoolUsers: () => SEED_USERS,
    schoolStudents: () => SEED_STUDENTS,
    schoolTeachers: () => SEED_TEACHERS,
    schoolClasses: () => SEED_CLASSES,
    schoolSubjects: () => SEED_SUBJECTS,
    schoolNotices: () => SEED_NOTICES,
    schoolUpdates: () => SEED_UPDATES,
    schoolEvents: () => SEED_EVENTS,
    schoolGallery: () => SEED_GALLERY,
    schoolAchievements: () => SEED_ACHIEVEMENTS,
    schoolDownloads: () => SEED_DOWNLOADS,
    schoolMessages: () => SEED_MESSAGES,
    schoolAttendance: buildAttendance,
    schoolResults: buildResults,
    schoolAssignments: buildAssignments,
    schoolTimetable: buildTimetable,
    schoolSubmissions: () => SEED_SUBMISSIONS,
  };

  /* Set by SGC.db.loadRemote() while a Firestore pull is what this device is
     showing, and cleared whenever the site falls back to the offline demo. */
  const REMOTE_FLAG = PREFIX + 'remoteData';
  function markRemote(on) {
    if (on) localStorage.setItem(REMOTE_FLAG, '1');
    else localStorage.removeItem(REMOTE_FLAG);
  }
  function isEmptyStore(key) {
    let v;
    try { v = JSON.parse(localStorage.getItem(PREFIX + key)); } catch (e) { return false; }
    if (Array.isArray(v)) return v.length === 0;
    if (v && typeof v === 'object') return Object.keys(v).length === 0;
    return true;
  }

  /* Leaving live mode leaves the server's rows on this device — including its
     empty ones, which a visitor to the demo would read as "the college has
     published nothing". Called once at start-up whenever the site turns out
     not to be live, this refills only the collections that are now blank and
     leaves everything the user actually typed alone. A collection a user
     emptied on purpose stays empty, because the flag is not set then. */
  function repairAfterRemote() {
    const wasRemote = localStorage.getItem(REMOTE_FLAG) === '1';
    markRemote(false);
    if (!wasRemote) return 0;
    let repaired = 0;
    COLLECTIONS.forEach((key) => {
      if (key === 'schoolUserPrefs' || !SEEDS[key]) return;
      if (localStorage.getItem(PREFIX + key) === null) return;
      if (!isEmptyStore(key)) return;
      writeRaw(key, SEEDS[key]());
      repaired++;
    });
    return repaired;
  }

  /* loadData('schoolNotices') → array or object from storage, or seed. */
  function loadData(key, fallback) {
    const has = localStorage.getItem(PREFIX + key) !== null;
    if (has) return readRaw(key, fallback !== undefined ? fallback : []);
    if (SEEDS[key]) {
      const seeded = SEEDS[key]();
      writeRaw(key, seeded);
      return seeded;
    }
    return fallback !== undefined ? fallback : [];
  }

  function saveData(key, value) { return writeRaw(key, value); }

  /* Write-through: mirror a local change to Firestore when a backend is
     live. Guarded so the offline demo (no SGC.backend, or not enabled)
     is completely unaffected and a server hiccup never breaks the save. */
  function remote(fn) { try { if (SGC.backend && SGC.backend.enabled) fn(); } catch (e) { /* keep local */ } }

  /* Generic CRUD over any array collection. */
  function all(key) { const v = loadData(key, []); return Array.isArray(v) ? v : []; }

  function insertData(key, record) {
    const list = all(key);
    const rec = Object.assign({ id: SGC.utils.uid(key.slice(0, 3).toLowerCase()), createdAt: SGC.utils.nowISO() }, record);
    list.unshift(rec);
    saveData(key, list);
    remote(() => SGC.backend.put(key, rec));
    return rec;
  }

  function findData(key, idOrPredicate) {
    const list = all(key);
    if (typeof idOrPredicate === 'function') return list.find(idOrPredicate) || null;
    return list.find((r) => r.id === idOrPredicate || r.studentId === idOrPredicate ||
      r.teacherId === idOrPredicate || r.identifier === idOrPredicate) || null;
  }

  function filterData(key, predicate) { return all(key).filter(predicate); }

  function updateData(key, id, patch) {
    const list = all(key);
    let updated = null;
    const next = list.map((r) => {
      if ((r.id || r.identifier) !== id) return r;
      updated = Object.assign({}, r, patch, { updatedAt: SGC.utils.nowISO() });
      return updated;
    });
    if (updated) saveData(key, next);
    if (updated) remote(() => SGC.backend.put(key, updated));
    return updated;
  }

  function deleteData(key, id) {
    const list = all(key);
    const rec = list.find((r) => (r.id || r.identifier) === id) || null;
    const next = list.filter((r) => (r.id || r.identifier) !== id);
    saveData(key, next);
    /* The record itself is passed so the server row is addressed by the same
       key a write uses (see SGC.backend). */
    remote(() => SGC.backend.remove(key, rec || { id }));
    return list.length !== next.length;
  }

  function count(key) { return all(key).length; }

  /* ---------------- settings ---------------- */
  function getSettings() { return Object.assign({}, SEED_SETTINGS, readRaw('schoolSettings', {}) || {}); }
  function saveSettings(patch) {
    const next = Object.assign({}, getSettings(), patch);
    writeRaw('schoolSettings', next);
    remote(() => SGC.backend.putSettings(next));
    return next;
  }

  /* ---------------- lookups used across pages ---------------- */
  function subjectName(id) { const s = findData('schoolSubjects', id); return s ? s.name : '—'; }
  function className(id) { const c = findData('schoolClasses', id); return c ? c.name : '—'; }
  function teacherName(id) { const t = findData('schoolTeachers', id); return t ? t.fullName : '—'; }
  function studentName(id) { const s = findData('schoolStudents', id); return s ? s.fullName : '—'; }

  /* ---------------- demo reset ---------------- */
  const SEEDED_FLAG = PREFIX + 'seedVersion';
  const SEED_VERSION = '2';

  function seedIfEmpty() {
    if (localStorage.getItem(SEEDED_FLAG) === SEED_VERSION) return false;
    COLLECTIONS.forEach((k) => { if (SEEDS[k]) writeRaw(k, SEEDS[k]()); });
    localStorage.setItem(SEEDED_FLAG, SEED_VERSION);
    return true;
  }

  function resetDemoData() {
    COLLECTIONS.forEach((k) => localStorage.removeItem(PREFIX + k));
    localStorage.removeItem(SEEDED_FLAG);
    markRemote(false);
    COLLECTIONS.forEach((k) => { if (SEEDS[k]) writeRaw(k, SEEDS[k]()); });
    localStorage.setItem(SEEDED_FLAG, SEED_VERSION);
  }

  /* Bulk-load collections pulled from Firestore into the same keys the
     synchronous readers above already use, so no page has to change.
     Called once by SGC.backend.pullAll() at start-up in live mode. */
  function loadRemote(map) {
    if (!map || typeof map !== 'object') return;
    COLLECTIONS.forEach((key) => {
      if (!Object.prototype.hasOwnProperty.call(map, key)) return;
      const v = map[key];
      if (v === undefined || v === null) return;   // server had nothing → keep defaults
      writeRaw(key, v);
    });
    // Remember that the server, not a first visit, is what filled these keys.
    markRemote(true);
    if (COLLECTIONS.some((k) => !isEmptyStore(k))) localStorage.setItem(SEEDED_FLAG, SEED_VERSION);
  }

  SGC.db = {
    PREFIX, COLLECTIONS,
    loadData, saveData, all, insertData, updateData, deleteData, findData, filterData, count,
    getSettings, saveSettings, seedIfEmpty, resetDemoData, loadRemote, repairAfterRemote,
    subjectName, className, teacherName, studentName,
  };
})(window);

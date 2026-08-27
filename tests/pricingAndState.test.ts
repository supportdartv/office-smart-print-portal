import { JobService } from '../server/services/jobService';
import { store } from '../server/db/store';

function runTests() {
  console.log('=== Running Office Smart Print Portal Unit & Integration Tests ===\n');
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, name: string) {
    if (condition) {
      console.log(`✓ PASS: ${name}`);
      passed++;
    } else {
      console.error(`✗ FAIL: ${name}`);
      failed++;
    }
  }

  // 1. Price Calculation Test
  const bwPrice = JobService.calculatePrice('BLACK_WHITE', 8, 1);
  assert(bwPrice.totalAmount === 1600, '8 pages B&W should equal 1600 paise (₹16)');
  assert(bwPrice.pricePerPage === 200, 'B&W price per page is 200 paise (₹2)');

  const colorPrice = JobService.calculatePrice('COLOR', 8, 1);
  assert(colorPrice.totalAmount === 4000, '8 pages Color should equal 4000 paise (₹40)');
  assert(colorPrice.pricePerPage === 500, 'Color price per page is 500 paise (₹5)');

  const officialPrice = JobService.calculatePrice('OFFICIAL', 8, 1);
  assert(officialPrice.totalAmount === 0, 'Official document print should equal 0 paise (FREE)');

  // 2. File and Job Creation Flow
  const dummyFileId = 'test-file-01';
  store.files.set(dummyFileId, {
    id: dummyFileId,
    originalFilename: 'quarterly_report.pdf',
    storagePath: '/tmp/test.pdf',
    mimeType: 'application/pdf',
    fileSize: 1024 * 50,
    pageCount: 8,
    checksum: 'dummy-checksum-sha256',
    status: 'READY',
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 1800000).toISOString()
  });

  const job = JobService.createJobAfterUpload('session-test-123', dummyFileId, 'office-printer-01', 8);
  assert(job.pageCount === 8, 'Job accurately inherited 8 pages from file record');
  assert(job.status === 'PROCESSING', 'Job initialized in PROCESSING state');

  // 3. Selection of B&W Option
  const selectionResult = JobService.selectPrintType(job.id, 'BLACK_WHITE', 1);
  assert(selectionResult.job.status === 'WAITING_PAYMENT', 'Job transitioned to WAITING_PAYMENT');
  assert(selectionResult.job.totalAmount === 1600, 'Job total amount set to 1600 paise');

  // 4. Official Confirmation Transition
  const officialJob = JobService.createJobAfterUpload('session-test-456', dummyFileId, 'office-printer-01', 8);
  JobService.selectPrintType(officialJob.id, 'OFFICIAL', 1);
  const confirmed = JobService.confirmOfficialPrint(officialJob.id, 'EMP-1024', 'Engineering', 'Architecture Spec Review');
  assert(confirmed.status === 'QUEUED', 'Official job transitioned directly to QUEUED');
  assert(confirmed.paymentVerified === true, 'Official job marked paymentVerified');

  console.log(`\nTest Summary: ${passed} passed, ${failed} failed.`);
  if (failed > 0) {
    process.exit(1);
  }
}

runTests();

// scripts/diagnoseForm.mjs
import 'dotenv/config';
import mongoose from 'mongoose';
import Applicant from '../models/Applicant.js';
import CoApplicant from '../models/CoApplicant.js';
import VehicleDetails from '../models/VehicleDetails.js';
import Application from '../models/Application.js';
import ApprovedApplication from '../models/ApprovedApplication.js';
import RejectedApplication from '../models/RejectedApplication.js';

function isFilled(v) {
  return v !== undefined && v !== null && String(v).trim() !== '';
}

function showKeys(obj) {
  if (!obj) return null;
  const keys = Object.keys(obj).sort();
  const sample = {};
  for (const k of keys) {
    const v = obj[k];
    // only show small value summary (avoid huge binary)
    sample[k] = (v && typeof v === 'object') ? '[object]' : String(v).slice(0, 200);
  }
  return { keys, sample };
}

async function main() {
  const formId = process.argv[2];
  if (!formId) {
    console.error('Usage: node scripts/diagnoseForm.mjs <FORMID>');
    process.exit(1);
  }

  const uri = process.env.MONGO_URI;
  console.log('MONGO_URI:', uri);
  await mongoose.connect(uri);

  const [applicant, coApplicant, vehicle, existingApp, approved, rejected] = await Promise.all([
    Applicant.findOne({ formId }).lean(),
    CoApplicant.findOne({ formId }).lean(),
    VehicleDetails.findOne({ formId }).lean(),
    Application.findOne({ formId }).lean(),
    ApprovedApplication.findOne({ formId }).lean(),
    RejectedApplication.findOne({ formId }).lean(),
  ]);

  console.log('=== EXISTING RECORDS ===');
  console.log('Application exists?', !!existingApp);
  console.log('Approved?', !!approved, approved?._id);
  console.log('Rejected?', !!rejected, rejected?._id);

  console.log('\n--- APPLICANT ---');
  console.log(JSON.stringify(showKeys(applicant), null, 2));
  console.log('Full applicant (first 1000 chars):');
  if (applicant) console.log(JSON.stringify(applicant, Object.keys(applicant).slice(0,50), 2).slice(0, 1000));
  else console.log('NONE');

  console.log('\n--- COAPPLICANT ---');
  console.log(JSON.stringify(showKeys(coApplicant), null, 2));
  if (coApplicant) console.log(JSON.stringify(coApplicant, Object.keys(coApplicant).slice(0,50), 2).slice(0, 1000));
  else console.log('NONE');

  console.log('\n--- VEHICLE ---');
  console.log(JSON.stringify(showKeys(vehicle), null, 2));
  if (vehicle) console.log(JSON.stringify(vehicle, Object.keys(vehicle).slice(0,50), 2).slice(0, 1000));
  else console.log('NONE');

  // Our current validators (copy of what's in service)
  const applicantChecks = {
    name: isFilled(applicant?.name) || isFilled(applicant?.applicantName) || isFilled(applicant?.fullName),
    panOrForm60: isFilled(applicant?.pan) || isFilled(applicant?.PAN) || isFilled(applicant?.form60),
    formId: isFilled(applicant?.formId) || isFilled(applicant?.formID) || isFilled(applicant?.form_id),
  };

  const coApplicantChecks = {
    present: !!coApplicant,
    name: isFilled(coApplicant?.name) || isFilled(coApplicant?.coApplicantName) || isFilled(coApplicant?.fullName),
    panOrForm60: isFilled(coApplicant?.pan) || isFilled(coApplicant?.PAN) || isFilled(coApplicant?.form60),
    formId: isFilled(coApplicant?.formId) || isFilled(coApplicant?.formID) || isFilled(coApplicant?.form_id),
  };

  const vehicleChecks = {
    formId: isFilled(vehicle?.formId) || isFilled(vehicle?.formID) || isFilled(vehicle?.form_id),
    model: isFilled(vehicle?.model) || isFilled(vehicle?.vehicleModel) || isFilled(vehicle?.make) || isFilled(vehicle?.variant),
    price: isFilled(vehicle?.exShowroomPrice) || isFilled(vehicle?.onRoadPrice) || isFilled(vehicle?.price) || isFilled(vehicle?.vehiclePrice),
  };

  console.log('\n--- VALIDATOR CHECKS ---');
  console.log('Applicant checks:', applicantChecks);
  console.log('CoApplicant checks:', coApplicantChecks);
  console.log('Vehicle checks:', vehicleChecks);

  // Build candidate payload (like the merge does)
  const resolvedDealerId = vehicle?.user || vehicle?.dealer || applicant?.user || coApplicant?.user || null;
  const payload = {
    formId,
    applicant: applicant || undefined,
    coApplicant: coApplicant || undefined,
    vehicleDetails: vehicle || undefined,
    dealer: resolvedDealerId || undefined,
    status: 'pending',
    workflowStage: 'new',
    history: [{ action: 'merge_dryrun', createdAt: new Date() }],
  };

  console.log('\n--- DRY-RUN VALIDATE PAYLOAD ---');
  try {
    const doc = new Application(payload);
    await doc.validate(); // will throw if schema rejects
    console.log('Validation OK: payload would be accepted by Application schema.');
  } catch (err) {
    console.error('Validation ERROR (schema rejected payload):');
    if (err && err.errors) {
      for (const [k, v] of Object.entries(err.errors)) {
        console.error(` - ${k}: ${v.message} (path=${v.path}, kind=${v.kind}, value=${JSON.stringify(v.value)})`);
      }
    } else {
      console.error(err);
    }
  }

  await mongoose.disconnect();
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });

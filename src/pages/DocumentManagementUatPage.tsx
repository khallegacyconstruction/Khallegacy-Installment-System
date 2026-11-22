import { useCallback, useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react';
import { supabase } from '../lib/supabase';

type ApplicationOption = { id: number; case_id: string; customer_name: string; ic_number: string };
type DocumentRecord = {
  id: number;
  application_id: number;
  document_type: string;
  file_name: string;
  storage_path: string;
  uploaded_at: string;
  remarks: string | null;
  file_size: string | null;
  file_type: string | null;
  summary: string | null;
};

const documentTypes = ['IC Front','IC Back','Payslip','Bank Statement','SSM','Agreement','Invoice','Other'];
const maxFileSize = 25 * 1024 * 1024;
const formatSize = (value: string | null) => {
  const bytes = Number(value ?? 0);
  if (!bytes) return '—';
  return bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(2)} MB` : `${(bytes / 1024).toFixed(1)} KB`;
};

export function DocumentManagementUatPage({ onBack }: { onBack: () => void }) {
  const [applications, setApplications] = useState<ApplicationOption[]>([]);
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [selectedApplicationId, setSelectedApplicationId] = useState('');
  const [documentType, setDocumentType] = useState(documentTypes[0]);
  const [file, setFile] = useState<File | null>(null);
  const [remarks, setRemarks] = useState('');
  const [summary, setSummary] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [openingId, setOpeningId] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const loadApplications = useCallback(async () => {
    setLoading(true); setError('');
    const { data, error: loadError } = await supabase.from('applications')
      .select('id,case_id,customer_name,ic_number').order('created_at', { ascending: false }).limit(500);
    if (loadError) { setError(loadError.message); setApplications([]); }
    else setApplications((data ?? []) as ApplicationOption[]);
    setLoading(false);
  }, []);

  const loadDocuments = useCallback(async (applicationId: string) => {
    if (!applicationId) { setDocuments([]); return; }
    const { data, error: loadError } = await supabase.from('application_documents').select('*')
      .eq('application_id', Number(applicationId)).order('uploaded_at', { ascending: false });
    if (loadError) { setError(loadError.message); setDocuments([]); }
    else setDocuments((data ?? []) as DocumentRecord[]);
  }, []);

  useEffect(() => { void loadApplications(); }, [loadApplications]);
  useEffect(() => { void loadDocuments(selectedApplicationId); }, [loadDocuments, selectedApplicationId]);

  const filteredApplications = useMemo(() => {
    const q = search.trim().toLowerCase();
    return applications.filter((row) => !q || [row.case_id,row.customer_name,row.ic_number].join(' ').toLowerCase().includes(q));
  }, [applications, search]);

  const handleFile = (event: ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files?.[0] ?? null;
    setFile(selected);
    setError('');
    if (selected && selected.size > maxFileSize) setError('Saiz fail melebihi had 25MB.');
    else if (selected && !['application/pdf','image/jpeg','image/png'].includes(selected.type)) setError('Hanya PDF, JPG dan PNG dibenarkan.');
  };

  const upload = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedApplicationId || !file) { setError('Pilih permohonan dan fail terlebih dahulu.'); return; }
    if (file.size > maxFileSize || !['application/pdf','image/jpeg','image/png'].includes(file.type)) {
      setError('Fail tidak memenuhi syarat jenis atau saiz.'); return;
    }
    setSaving(true); setError(''); setNotice('');
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storagePath = `${selectedApplicationId}/${Date.now()}-${Math.random().toString(36).slice(2,10)}-${safeName}`;
    const { error: uploadError } = await supabase.storage.from('application-documents').upload(storagePath, file, {
      contentType: file.type, upsert: false,
    });
    if (uploadError) {
      setError(uploadError.message);
      setSaving(false);
      return;
    }
    const { error: registerError } = await supabase.rpc('register_application_document', {
      p_application_id: Number(selectedApplicationId),
      p_document_type: documentType,
      p_file_name: file.name,
      p_storage_path: storagePath,
      p_file_size: String(file.size),
      p_file_type: file.type,
      p_remarks: remarks,
      p_summary: summary,
    });
    if (registerError) {
      await supabase.storage.from('application-documents').remove([storagePath]);
      setError(registerError.message);
    } else {
      setNotice(`Dokumen ${file.name} berjaya dimuat naik dan direkodkan.`);
      setFile(null); setRemarks(''); setSummary('');
      await loadDocuments(selectedApplicationId);
    }
    setSaving(false);
  };

  const openDocument = async (document: DocumentRecord) => {
    setOpeningId(document.id); setError('');
    const { data, error: urlError } = await supabase.storage.from('application-documents')
      .createSignedUrl(document.storage_path, 120);
    if (urlError) setError(urlError.message);
    else if (data?.signedUrl) window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
    setOpeningId(null);
  };

  const selectedApplication = applications.find((row) => String(row.id) === selectedApplicationId);

  return (
    <section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div><p className="text-xs font-semibold uppercase tracking-widest text-blue-700">Supabase UAT</p><h2 className="mt-1 text-xl font-bold">Document Management</h2><p className="mt-1 text-sm text-slate-500">Muat naik, simpan dan buka dokumen pelanggan melalui private Storage.</p></div>
        <div className="flex gap-2"><button type="button" onClick={() => void loadApplications()} disabled={loading} className="rounded-lg border px-3 py-2 text-sm font-semibold">Refresh</button><button type="button" onClick={onBack} className="rounded-lg border px-3 py-2 text-sm font-semibold">Kembali</button></div>
      </header>
      {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {notice && <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}
      <label className="block text-sm font-medium">Cari permohonan
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="CASE ID / nama / IC" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
      </label>
      <label className="block text-sm font-medium">Pilih permohonan
        <select value={selectedApplicationId} onChange={(event) => setSelectedApplicationId(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2">
          <option value="">Pilih CASE ID</option>
          {filteredApplications.map((row) => <option key={row.id} value={row.id}>{row.case_id} · {row.customer_name} · {row.ic_number}</option>)}
        </select>
      </label>
      {selectedApplication && <div className="rounded-lg bg-slate-50 p-3 text-sm"><strong>{selectedApplication.case_id}</strong> · {selectedApplication.customer_name}<span className="block text-slate-500">IC: {selectedApplication.ic_number}</span></div>}

      <form onSubmit={upload} className="rounded-xl border border-slate-200 p-4">
        <h3 className="font-semibold">Upload Document</h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="text-sm font-medium">Document Type
            <select value={documentType} onChange={(event) => setDocumentType(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2">{documentTypes.map((type) => <option key={type}>{type}</option>)}</select>
          </label>
          <label className="text-sm font-medium">Fail (PDF / JPG / PNG, maksimum 25MB)
            <input key={file ? file.name : "empty"} type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" onChange={handleFile} className="mt-1 block w-full text-sm" />
          </label>
          <label className="text-sm font-medium sm:col-span-2">Summary (Optional)
            <input value={summary} onChange={(event) => setSummary(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
          </label>
          <label className="text-sm font-medium sm:col-span-2">Remarks (Optional)
            <textarea value={remarks} onChange={(event) => setRemarks(event.target.value)} rows={2} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
          </label>
        </div>
        {file && <p className="mt-2 text-xs text-slate-500">Dipilih: {file.name} · {formatSize(String(file.size))}</p>}
        <button disabled={saving || !selectedApplicationId || !file || Boolean(error)} className="mt-3 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving ? 'Memuat naik...' : 'Upload Document'}</button>
      </form>

      <div className="rounded-xl border border-slate-200 p-4">
        <h3 className="font-semibold">Document List ({documents.length})</h3>
        {!selectedApplicationId ? <p className="mt-3 text-sm text-slate-500">Pilih permohonan untuk melihat dokumen.</p> :
          documents.length === 0 ? <p className="mt-3 text-sm text-slate-500">Belum ada dokumen untuk permohonan ini.</p> :
          <div className="mt-3 overflow-x-auto"><table className="min-w-[700px] w-full text-left text-xs">
            <thead className="bg-slate-50 uppercase text-slate-500"><tr><th className="p-3">Document</th><th className="p-3">Type</th><th className="p-3">Size</th><th className="p-3">Uploaded</th><th className="p-3"></th></tr></thead>
            <tbody>{documents.map((document) => <tr key={document.id} className="border-t border-slate-100">
              <td className="p-3"><strong>{document.file_name}</strong>{document.summary && <span className="block text-slate-500">{document.summary}</span>}</td>
              <td className="p-3">{document.document_type}</td><td className="p-3">{formatSize(document.file_size)}</td><td className="p-3">{new Date(document.uploaded_at).toLocaleString('en-MY')}</td>
              <td className="p-3"><button type="button" onClick={() => void openDocument(document)} disabled={openingId === document.id} className="rounded border border-blue-200 px-3 py-1.5 font-semibold text-blue-700">{openingId === document.id ? 'Opening...' : 'View / Download'}</button></td>
            </tr>)}</tbody>
          </table></div>}
      </div>
    </section>
  );
}

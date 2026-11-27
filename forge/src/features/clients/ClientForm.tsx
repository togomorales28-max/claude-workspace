import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button, Field, Input, Modal, Textarea } from '@/components/ui';
import { clientsRepo } from '@/data/repo';
import { validateClient, type Errors } from '@/domain/validation';
import type { Client } from '@/domain/types';

type Draft = { name: string; phone: string; email: string; address: string; notes: string };

export function ClientForm({ open, onClose, client }: { open: boolean; onClose: () => void; client?: Client | null }) {
  const [d, setD] = useState<Draft>({ name: '', phone: '', email: '', address: '', notes: '' });
  const [errors, setErrors] = useState<Errors>({});
  useEffect(() => {
    if (open) {
      setErrors({});
      setD({ name: client?.name ?? '', phone: client?.phone ?? '', email: client?.email ?? '', address: client?.address ?? '', notes: client?.notes ?? '' });
    }
  }, [open, client]);

  const save = async () => {
    const e = validateClient(d);
    setErrors(e);
    if (Object.keys(e).length) return;
    const data = { name: d.name.trim(), phone: d.phone.trim(), email: d.email.trim(), address: d.address.trim(), notes: d.notes.trim() };
    if (client) {
      await clientsRepo.update(client.id, data);
      toast.success('Cliente actualizado');
    } else {
      await clientsRepo.create(data);
      toast.success('Cliente registrado');
    }
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={client ? 'Editar cliente' : 'Nuevo cliente'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={save}>
            Guardar
          </Button>
        </>
      }
    >
      <form
        className="grid gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <Field label="Nombre" required error={errors.name}>
          <Input value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} invalid={!!errors.name} maxLength={100} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Teléfono / WhatsApp" error={errors.phone}>
            <Input type="tel" inputMode="tel" value={d.phone} onChange={(e) => setD({ ...d, phone: e.target.value })} placeholder="10 dígitos" invalid={!!errors.phone} />
          </Field>
          <Field label="Correo (opcional)" error={errors.email}>
            <Input type="email" value={d.email} onChange={(e) => setD({ ...d, email: e.target.value })} invalid={!!errors.email} />
          </Field>
        </div>
        <Field label="Dirección (opcional)">
          <Input value={d.address} onChange={(e) => setD({ ...d, address: e.target.value })} />
        </Field>
        <Field label="Notas">
          <Textarea value={d.notes} onChange={(e) => setD({ ...d, notes: e.target.value })} rows={2} />
        </Field>
        <button type="submit" className="hidden" />
      </form>
    </Modal>
  );
}

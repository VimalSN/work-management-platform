import { useState } from 'react';
import type { FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useToast } from './ui/ToastContext';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Modal } from './ui/Modal';

export function CreateProjectModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const createProject = useMutation({
    mutationFn: () =>
      api.post(
        '/projects',
        { name, description: description || undefined },
        { headers: { 'Idempotency-Key': crypto.randomUUID() } },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      showToast('success', 'Project created');
      onClose();
    },
    onError: () => showToast('error', 'Could not create project'),
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    createProject.mutate();
  }

  return (
    <Modal title="New project" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-3">
        <label className="block text-sm">
          <span className="text-slate-500 text-xs">Project name</span>
          <Input value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
        </label>
        <label className="block text-sm">
          <span className="text-slate-500 text-xs">Description (optional)</span>
          <textarea
            className="input min-h-20 resize-y"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={createProject.isPending} disabled={!name.trim()}>
            Create project
          </Button>
        </div>
      </form>
    </Modal>
  );
}

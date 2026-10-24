import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { keys } from '@/lib/queryClient'
import { Dialog } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { ErrorState } from '@/components/ui/States'
import { toast } from '@/components/ui/Toast'
import { VendorFields, toBody, toDraft, validate } from './VendorForm'
import { vendorKeys } from './shared'

function AddVendorForm({ clubId, api, categories, defaultCategory, onDone }) {
  const qc = useQueryClient()
  const [draft, setDraft] = useState(() => ({ ...toDraft(null), category: defaultCategory ?? '' }))
  const [errors, setErrors] = useState({})

  const create = useMutation({
    mutationFn: (body) => api.vendors.create(body),
    onSuccess: (vendor) => {
      // Drop it into the cached "all" list right away so the card animates in without waiting for the refetch.
      qc.setQueryData(vendorKeys.list(clubId, ''), (list) =>
        Array.isArray(list) ? [...list, vendor].sort((a, b) => a.name.localeCompare(b.name)) : list,
      )
      toast(`Added ${vendor.name}`)
      onDone(vendor)
    },
    onSettled: () => qc.invalidateQueries({ queryKey: keys.club(clubId) }),
  })

  const submit = (e) => {
    e.preventDefault()
    const errs = validate(draft)
    setErrors(errs)
    if (Object.keys(errs).length === 0) create.mutate(toBody(draft))
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <VendorFields
        draft={draft}
        onChange={(patch) => setDraft((d) => ({ ...d, ...patch }))}
        errors={errors}
        categories={categories}
        autoFocus
      />
      {create.isError && <ErrorState compact error={create.error} />}
      <div className="-mx-6 -mb-5 flex justify-end gap-2 border-t border-line px-6 py-4">
        <Button variant="ghost" type="button" onClick={() => onDone(null)}>
          Cancel
        </Button>
        <Button type="submit" loading={create.isPending}>
          {!create.isPending && <Plus className="size-4" aria-hidden />}
          Add vendor
        </Button>
      </div>
    </form>
  )
}

export function AddVendorDialog({ open, onOpenChange, clubId, api, categories, defaultCategory, onCreated }) {
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Add a vendor"
      description="Save a business your club is considering. ClubOS doesn't verify vendors, so double-check details before booking."
    >
      {/* The Dialog unmounts its content after closing, so each open starts with a fresh form. */}
      <AddVendorForm
        clubId={clubId}
        api={api}
        categories={categories}
        defaultCategory={defaultCategory}
        onDone={(vendor) => {
          onOpenChange(false)
          if (vendor) onCreated?.(vendor)
        }}
      />
    </Dialog>
  )
}

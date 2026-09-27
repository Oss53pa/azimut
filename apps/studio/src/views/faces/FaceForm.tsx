import { type JSX, useState } from 'react';
import { declareFaceCommand, updateFaceCommand, supportTypologyOf } from '@azimut/core-model';
import { useSiteData } from '../../context/useSiteData.js';
import { useI18n } from '../../i18n/useI18n.js';
import { SelectField, MultiChoice, Button, SPACE, type Option } from '../../components/ui/index.js';
import type { CommandWrite } from '../../state/use-command-write.js';
import { single } from '../../state/use-command-write.js';
import { FindingList } from '../message-schedule/FindingList.js';
import type { FaceSlot } from './face-slots.js';

/** La valeur du sélecteur qui laisse la face suivre le gabarit de la typologie. */
const INHERITED = '';

type FaceFormProps = {
  readonly slot: FaceSlot;
  readonly write: CommandWrite;
};

/**
 * A5.6 — le gabarit et les langues d'une face, déclarée ou à déclarer. Monté
 * avec une clé par face : changer de face repart de ses valeurs en base.
 */
export function FaceForm({ slot, write }: FaceFormProps): JSX.Element {
  const site = useSiteData();
  const { t } = useI18n();
  const [template, setTemplate] = useState(slot.face?.template_key ?? INHERITED);
  const [langs, setLangs] = useState<readonly string[]>(slot.face?.langs ?? []);

  // Les gabarits de la typologie du support d'abord ; tous, si aucun ne lui est propre.
  const typology = supportTypologyOf(site.support_types, slot.support);
  const own = site.face_templates.filter(tpl => tpl.support_type_key === typology?.key);
  const offered = own.length > 0 ? own : site.face_templates;
  const current = slot.face?.template_key;
  const templateOptions: readonly Option[] = [
    { value: INHERITED, label: t('supportfaces.template.inherited') },
    ...offered.map(tpl => ({ value: tpl.id, label: tpl.name })),
    ...(current !== undefined && !offered.some(tpl => tpl.id === current) ? [{ value: current, label: current }] : []),
  ];
  const langOptions: readonly Option[] = site.site.active_langs.map(l => ({ value: l, label: l }));
  const inactive = write.readonly || write.busy;

  function submit(): void {
    const draft = { template_key: template === INHERITED ? null : template, langs };
    const timestamp = new Date().toISOString();
    if (slot.face === undefined) {
      const outcome = declareFaceCommand(site, slot.support.id, slot.faceIndex, draft, {
        newId: () => crypto.randomUUID(), timestamp,
      });
      void write.send(single(outcome), 'supportfaces.form.declared');
    } else {
      void write.send(single(updateFaceCommand(site, slot.face, draft, timestamp)), 'supportfaces.form.saved');
    }
  }

  return (
    <section style={{ padding: '12px 16px', display: 'grid', gap: SPACE.md }}>
      <SelectField
        label={t('supportfaces.form.template')}
        value={template}
        options={templateOptions}
        onChange={setTemplate}
        hint={t('supportfaces.form.template.hint')}
        disabled={inactive}
      />
      <MultiChoice
        label={t('supportfaces.form.langs')}
        options={langOptions}
        selected={langs}
        onChange={setLangs}
        hint={t('supportfaces.form.langs.hint')}
        disabled={inactive}
      />
      <FindingList findings={write.findings} empty="" />
      <div>
        <Button rank="primary" onClick={submit} disabled={inactive}>
          {slot.face === undefined ? t('supportfaces.form.declare') : t('supportfaces.form.save')}
        </Button>
      </div>
    </section>
  );
}

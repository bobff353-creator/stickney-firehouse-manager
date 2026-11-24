'use client';
import {itemCheckFields,type ItemCheckField} from './inventory-drug-model';
export default function ItemCheckFields({fields,onChange,disabled=false,label='Required for each item'}:{fields:ItemCheckField[];onChange:(fields:ItemCheckField[])=>void;disabled?:boolean;label?:string}){
 return <fieldset className="container-required-fields" disabled={disabled}><legend>{label}</legend><p>Quantity 2 means two separate entries for every selected field. Quantity and observed result are also required.</p>{itemCheckFields.map(([key,text])=><label key={key}><input type="checkbox" checked={fields.includes(key)} onChange={event=>onChange(event.target.checked?[...fields,key]:fields.filter(field=>field!==key))}/>{text}</label>)}</fieldset>;
}

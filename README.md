let cart=[];
fetch('products.json').then(r=>r.json()).then(products=>{
 const container=document.getElementById('products');
 const render=list=>{
  container.innerHTML='';
  list.forEach((p,i)=>{
    const d=document.createElement('div');d.className='card';
    d.innerHTML=`<img src="${p.image}" alt=""><h3>${p.title}</h3><p>£${p.price}</p><p>Stock: ${p.stock}</p><input class="qty" id="q${i}" type="number" min="1" value="1"><button>Add</button>`;
    d.querySelector('button').onclick=()=>{const q=+d.querySelector('input').value;cart.push({title:p.title,qty:q});updateCart();};
    container.appendChild(d);
  });
 };
 render(products);
 document.getElementById('search').oninput=e=>{
   const t=e.target.value.toLowerCase();
   render(products.filter(p=>p.title.toLowerCase().includes(t)));
 };
});
function updateCart(){document.getElementById('cartItems').innerHTML=cart.map(i=>`<li>${i.title} x ${i.qty}</li>`).join('');}

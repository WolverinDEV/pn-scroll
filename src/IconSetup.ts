// Generate required css
// @ts-ignore
import iconFont from 'react-native-vector-icons/Fonts/FontAwesome.ttf';
const iconFontStyles = `@font-face {
  src: url(${iconFont});
  font-family: FontAwesome;
}`;

const style = document.createElement('style');
style.type = 'text/css';
style.appendChild(document.createTextNode(iconFontStyles));

document.head.appendChild(style);
